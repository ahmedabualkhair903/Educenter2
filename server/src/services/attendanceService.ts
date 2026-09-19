import crypto from "node:crypto";
import { getDatabase } from "../database/db.js";
import { logAudit } from "../middleware/audit.js";
import type { AttendanceRecord, AttendanceSession, SuspiciousAttendanceCase } from "../models/index.js";
import { attendanceRepository } from "../repositories/attendanceRepository.js";
import { groupRepository } from "../repositories/groupRepository.js";
import { studentRepository } from "../repositories/studentRepository.js";
import { AppError } from "../utils/response.js";
import { notificationService } from "./notificationService.js";

// In-memory cache for rapid scan debouncing and suspicious detection
const recentScansMap = new Map<string, { studentId: string; timestamp: number }>();

export const attendanceService = {
  createSession(data: {
    groupId: string;
    lessonId?: string | null;
    date?: string;
    startTime?: string;
    password?: string | null;
    qrCode?: string | null;
  }, openerId?: string, ip?: string): AttendanceSession {
    const group = groupRepository.findById(data.groupId);
    if (!group) {
      throw new AppError("المجموعة غير موجودة", 404, "GROUP_NOT_FOUND");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const date = data.date || now.split("T")[0];
    const startTime = data.startTime || now.split("T")[1].substring(0, 5);

    attendanceRepository.createSession({
      id,
      group_id: data.groupId,
      lesson_id: data.lessonId || null,
      date,
      start_time: startTime,
      status: "open",
      password: data.password || null,
      qr_code: data.qrCode || `SESSION-${id.substring(0, 8)}`,
      opened_by: openerId || null,
      sync_id: crypto.randomUUID(),
      created_at: now,
    });

    logAudit({
      userId: openerId,
      action: "OPEN_ATTENDANCE_SESSION",
      entityType: "ATTENDANCE_SESSION",
      entityId: id,
      newData: { groupName: group.name, date, startTime },
      ip,
    });

    return attendanceRepository.findSessionById(id)!;
  },

  closeSession(id: string, closedBy?: string, ip?: string): AttendanceSession {
    const session = attendanceRepository.findSessionById(id);
    if (!session) {
      throw new AppError("جلسة الحضور غير موجودة", 404, "SESSION_NOT_FOUND");
    }

    attendanceRepository.closeSession(id, closedBy);

    logAudit({
      userId: closedBy,
      action: "CLOSE_ATTENDANCE_SESSION",
      entityType: "ATTENDANCE_SESSION",
      entityId: id,
      oldData: session,
      ip,
    });

    return attendanceRepository.findSessionById(id)!;
  },

  listSessions(filters?: { groupId?: string; date?: string; status?: string }): AttendanceSession[] {
    return attendanceRepository.listSessions(filters);
  },

  listRecords(filters: {
    sessionId?: string;
    groupId?: string;
    studentId?: string;
    date?: string;
    status?: string;
  }): AttendanceRecord[] {
    return attendanceRepository.listRecords(filters);
  },

  async scanBarcodeOrQR(params: {
    code: string;
    sessionId?: string;
    groupId?: string;
    lessonId?: string;
    deviceId?: string;
    locationStatus?: "allowed" | "outside" | "unknown";
    checkOut?: boolean;
  }, scannerUserId?: string, ip?: string): Promise<{
    success: boolean;
    alreadyRegistered?: boolean;
    isCheckOut?: boolean;
    student: {
      id: string;
      name: string;
      code: string;
      grade: string;
      phone?: string;
      guardianPhone: string;
    };
    attendance: {
      id: string;
      sessionId: string;
      status: string;
      time: string;
      method: string;
    };
    message: string;
  }> {
    const rawCode = params.code.trim();
    if (!rawCode) {
      throw new AppError("كود الطالب أو الباركود مطلوب", 400, "INVALID_CODE");
    }

    // 1. Resolve student by code, barcode, or clean phone
    let student = studentRepository.findByCode(rawCode);
    if (!student) {
      // Try searching by phone
      const phoneMatches = studentRepository.findByPhone(rawCode);
      if (phoneMatches.length === 1) {
        student = phoneMatches[0];
      }
    }

    if (!student) {
      throw new AppError(`لم يتم العثور على طالب بالكود أو الباركود: "${rawCode}"`, 404, "STUDENT_NOT_FOUND");
    }

    // 2. Resolve Active Session
    let session: AttendanceSession | undefined;
    if (params.sessionId) {
      session = attendanceRepository.findSessionById(params.sessionId);
    } else if (params.groupId) {
      session = attendanceRepository.findOpenSessionForGroup(params.groupId);
    } else if (student.groupId) {
      session = attendanceRepository.findOpenSessionForGroup(student.groupId);
    }

    // If still no session found, check if there is any open session for the center
    if (!session) {
      const openSessions = attendanceRepository.listSessions({ status: "open" });
      if (openSessions.length === 1) {
        session = openSessions[0];
      } else if (openSessions.length > 1 && student.groupId) {
        session = openSessions.find((s) => s.groupId === student.groupId) || openSessions[0];
      }
    }

    if (!session) {
      throw new AppError("لا توجد جلسة حضور مفتوحة حاليًا لهذه المجموعة. يرجى فتح جلسة أولاً", 400, "NO_OPEN_SESSION");
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
    const nowIso = now.toISOString();

    // 3. Suspicious Multi-Scan Detection (rapid scans from same device)
    if (params.deviceId) {
      const lastScan = recentScansMap.get(params.deviceId);
      if (lastScan && lastScan.studentId !== student.id && (now.getTime() - lastScan.timestamp) < 1500) {
        attendanceRepository.createSuspiciousCase({
          id: crypto.randomUUID(),
          attendance_ids: [],
          student_ids: [lastScan.studentId, student.id],
          student_names: [student.name],
          reason: "مسح سريع جدًا لعدة طلاب من نفس الجهاز في أقل من ثانية ونصف",
          device_id: params.deviceId,
          status: "pending",
          detected_at: nowIso,
          created_at: nowIso,
        });
      }
      recentScansMap.set(params.deviceId, { studentId: student.id, timestamp: now.getTime() });
    }

    // 4. Check existing record in session
    const existingRecord = attendanceRepository.findRecord(session.id, student.id);

    // If Check-Out is requested
    if (params.checkOut) {
      if (!existingRecord) {
        // Create check out directly
        const recordId = crypto.randomUUID();
        attendanceRepository.recordAttendance({
          id: recordId,
          session_id: session.id,
          student_id: student.id,
          group_id: session.groupId,
          lesson_id: session.lessonId || null,
          status: "present",
          check_in_time: timeStr,
          check_out_time: timeStr,
          method: "barcode",
          location_status: params.locationStatus || "allowed",
          device_id: params.deviceId || null,
          sync_id: crypto.randomUUID(),
          created_at: nowIso,
          updated_at: nowIso,
        });
      } else {
        attendanceRepository.updateCheckOut(session.id, student.id, timeStr);
      }

      const recipientPhone = student.guardianPhone || student.phone;
      if (recipientPhone) {
        notificationService.onStudentCheckOut(student.name, recipientPhone, timeStr, student.id);
      }

      return {
        success: true,
        isCheckOut: true,
        student: {
          id: student.id,
          name: student.name,
          code: student.studentId,
          grade: student.grade,
          phone: student.phone,
          guardianPhone: student.guardianPhone,
        },
        attendance: {
          id: existingRecord?.id || crypto.randomUUID(),
          sessionId: session.id,
          status: "present",
          time: timeStr,
          method: "barcode",
        },
        message: `تم تسجيل انصراف الطالب ${student.name} بنجاح الساعة ${timeStr}`,
      };
    }

    // Regular Check-In
    if (existingRecord && existingRecord.status === "present" && existingRecord.checkedInAt) {
      return {
        success: true,
        alreadyRegistered: true,
        student: {
          id: student.id,
          name: student.name,
          code: student.studentId,
          grade: student.grade,
          phone: student.phone,
          guardianPhone: student.guardianPhone,
        },
        attendance: {
          id: existingRecord.id,
          sessionId: session.id,
          status: existingRecord.status,
          time: existingRecord.checkedInAt,
          method: existingRecord.method || "barcode",
        },
        message: `الطالب ${student.name} مسجل حضوره بالفعل في هذه الجلسة الساعة ${existingRecord.checkedInAt}`,
      };
    }

    const recordId = existingRecord?.id || crypto.randomUUID();
    attendanceRepository.recordAttendance({
      id: recordId,
      session_id: session.id,
      student_id: student.id,
      group_id: session.groupId,
      lesson_id: session.lessonId || null,
      status: "present",
      check_in_time: timeStr,
      method: "barcode",
      location_status: params.locationStatus || "allowed",
      device_id: params.deviceId || null,
      sync_id: crypto.randomUUID(),
      created_at: nowIso,
      updated_at: nowIso,
    });

    const recipientPhone = student.guardianPhone || student.phone;
    if (recipientPhone) {
      notificationService.onStudentCheckIn(student.name, recipientPhone, timeStr, student.id);
    }

    logAudit({
      userId: scannerUserId,
      action: "RECORD_ATTENDANCE_SCAN",
      entityType: "ATTENDANCE_RECORD",
      entityId: recordId,
      newData: { studentName: student.name, time: timeStr, sessionId: session.id },
      ip,
    });

    return {
      success: true,
      alreadyRegistered: false,
      student: {
        id: student.id,
        name: student.name,
        code: student.studentId,
        grade: student.grade,
        phone: student.phone,
        guardianPhone: student.guardianPhone,
      },
      attendance: {
        id: recordId,
        sessionId: session.id,
        status: "present",
        time: timeStr,
        method: "barcode",
      },
      message: `تم تسجيل حضور الطالب ${student.name} بنجاح الساعة ${timeStr}`,
    };
  },

  recordManual(sessionId: string, records: { studentId: string; status: "present" | "absent" | "late" | "excused" | "unrecorded" }[], recorderId?: string, ip?: string): void {
    const session = attendanceRepository.findSessionById(sessionId);
    if (!session) {
      throw new AppError("جلسة الحضور غير موجودة", 404, "SESSION_NOT_FOUND");
    }

    const db = getDatabase();
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
    const nowIso = now.toISOString();

    db.transaction(() => {
      for (const rec of records) {
        const id = crypto.randomUUID();
        attendanceRepository.recordAttendance({
          id,
          session_id: sessionId,
          student_id: rec.studentId,
          group_id: session.groupId,
          lesson_id: session.lessonId || null,
          status: rec.status,
          check_in_time: rec.status === "present" || rec.status === "late" ? timeStr : null,
          method: "manual",
          sync_id: crypto.randomUUID(),
          created_at: nowIso,
          updated_at: nowIso,
        });

        if (rec.status === "absent") {
          const student = studentRepository.findById(rec.studentId);
          if (student && (student.guardianPhone || student.phone)) {
            notificationService.onAbsence(student.name, student.guardianPhone || student.phone!, session.groupName || "المجموعة", session.date, student.id);
          }
        }
      }
    })();

    logAudit({
      userId: recorderId,
      action: "RECORD_MANUAL_ATTENDANCE",
      entityType: "ATTENDANCE_SESSION",
      entityId: sessionId,
      newData: { count: records.length },
      ip,
    });
  },

  listSuspiciousCases(): SuspiciousAttendanceCase[] {
    return attendanceRepository.listSuspiciousCases();
  },

  createSuspiciousCase(data: any): any {
    return attendanceRepository.createSuspiciousCase(data);
  },

  updateSuspiciousCase(id: string, updates: { status?: string; note?: string }): any {
    return attendanceRepository.updateSuspiciousCase(id, updates);
  },
};
