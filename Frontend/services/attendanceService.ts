import { api } from "@/lib/api";
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  SuspiciousAttendanceCase,
} from "@/types";

// ─── Scanner result types (preserved for frontend compatibility) ───────────────

export type AttendanceScannerStatus =
  | "success"
  | "already_registered"
  | "invalid"
  | "disabled"
  | "error";

export type AttendanceScannerResult = {
  status: AttendanceScannerStatus;
  record: AttendanceRecord | null;
  studentId: string | null;
  studentName: string | null;
  checkedInAt: string | null;
  message: string;
};

// ─── Backend response shape from POST /attendance/scan ───────────────────────

interface ScanApiResponse {
  status: AttendanceScannerStatus;
  message: string;
  studentId: string | null;
  studentName: string | null;
  checkedInAt: string | null;
  record: AttendanceRecord | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const attendanceService = {
  list: async (params?: {
    groupId?: string;
    sessionId?: string;
    studentId?: string;
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<AttendanceRecord[]> => {
    const res = await api.get<AttendanceRecord[]>("/attendance", params as Record<string, string>);
    return res.data;
  },

  listByStudent: async (studentId: string): Promise<AttendanceRecord[]> => {
    const res = await api.get<AttendanceRecord[]>("/attendance", { studentId });
    return res.data;
  },

  listByGroup: async (groupId: string): Promise<AttendanceRecord[]> => {
    const res = await api.get<AttendanceRecord[]>("/attendance", { groupId });
    return res.data;
  },

  listByLesson: async (lessonId: string): Promise<AttendanceRecord[]> => {
    const res = await api.get<AttendanceRecord[]>("/attendance", {
      sessionId: lessonId,
    });
    return res.data;
  },

  listBySession: async (
    groupId: string,
    lessonId: string,
  ): Promise<AttendanceRecord[]> => {
    const res = await api.get<AttendanceRecord[]>("/attendance", {
      groupId,
      sessionId: lessonId,
    });
    return res.data;
  },

  getById: async (id: string): Promise<AttendanceRecord | null> => {
    try {
      const res = await api.get<AttendanceRecord>(`/attendance/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  create: async (
    record: Omit<AttendanceRecord, "id">,
  ): Promise<AttendanceRecord> => {
    const res = await api.post<AttendanceRecord>("/attendance", record);
    return res.data;
  },

  /**
   * QR/Barcode scan — POST /api/attendance/scan
   * Backend handles all business rules (duplicate check, student lookup, etc.)
   */
  scanCheckIn: async (
    code: string,
    sessionId?: string,
  ): Promise<AttendanceScannerResult> => {
    try {
      const normalized = code.replace(/[\r\n\t]/g, "").trim();
      if (!normalized) {
        return {
          status: "invalid",
          record: null,
          studentId: null,
          studentName: null,
          checkedInAt: null,
          message: "الكارت غير معروف.",
        };
      }

      const res = await api.post<ScanApiResponse>("/attendance/scan", {
        code: normalized,
        ...(sessionId ? { sessionId } : {}),
      });

      const d = res.data;
      return {
        status: d.status,
        record: d.record,
        studentId: d.studentId,
        studentName: d.studentName,
        checkedInAt: d.checkedInAt,
        message: d.message,
      };
    } catch {
      return {
        status: "error",
        record: null,
        studentId: null,
        studentName: null,
        checkedInAt: null,
        message: "حدث خطأ أثناء التسجيل.",
      };
    }
  },

  /**
   * Manual check-in by studentId — POST /api/attendance/scan
   */
  manualCheckIn: async (
    studentId: string,
    sessionId?: string,
  ): Promise<AttendanceScannerResult> => {
    return attendanceService.scanCheckIn(studentId, sessionId);
  },

  /**
   * Open attendance sessions — GET /api/attendance/sessions
   */
  listSessions: async (params?: {
    groupId?: string;
    date?: string;
    status?: string;
  }): Promise<AttendanceSession[]> => {
    try {
      const res = await api.get<AttendanceSession[]>(
        "/attendance/sessions",
        params as Record<string, string>,
      );
      return res.data;
    } catch {
      return [];
    }
  },

  /**
   * Open a new attendance session — POST /api/attendance/sessions
   * Returns the created open session ready to receive check-ins.
   */
  openSession: async (input: {
    groupId: string;
    lessonId?: string;
    date?: string;
    startTime?: string;
  }): Promise<AttendanceSession> => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    const clock = `${String(
      now.getHours(),
    ).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;

    const res = await api.post<AttendanceSession>(
      "/attendance/sessions",
      {
        groupId: input.groupId,
        lessonId: input.lessonId || undefined,
        date: input.date || today,
        startTime: input.startTime || clock,
      },
    );
    return res.data;
  },

  updateStatus: async (
    id: string,
    status: AttendanceStatus,
  ): Promise<AttendanceRecord | null> => {
    try {
      const res = await api.patch<AttendanceRecord>(`/attendance/${id}`, {
        status,
      });
      return res.data;
    } catch {
      return null;
    }
  },

  checkOut: async (id: string): Promise<AttendanceRecord | null> => {
    try {
      const res = await api.post<AttendanceRecord>(
        `/attendance/${id}/checkout`,
        {},
      );
      return res.data;
    } catch {
      return null;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/attendance/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  // ─── Suspicious cases (future backend feature — empty for now) ───────────────

  listSuspicious: async (): Promise<SuspiciousAttendanceCase[]> => {
    try {
      const res = await api.get<SuspiciousAttendanceCase[]>(
        "/attendance/suspicious",
      );
      return res.data;
    } catch {
      return [];
    }
  },

  createSuspicious: async (
    caseData: Omit<SuspiciousAttendanceCase, "id">,
  ): Promise<SuspiciousAttendanceCase> => {
    const res = await api.post<SuspiciousAttendanceCase>(
      "/attendance/suspicious",
      caseData,
    );
    return res.data;
  },

  updateSuspiciousStatus: async (
    id: string,
    status: SuspiciousAttendanceCase["status"],
  ): Promise<SuspiciousAttendanceCase | null> => {
    try {
      const res = await api.patch<SuspiciousAttendanceCase>(
        `/attendance/suspicious/${id}`,
        { status },
      );
      return res.data;
    } catch {
      return null;
    }
  },

  updateSuspiciousNote: async (
    id: string,
    note: string,
  ): Promise<SuspiciousAttendanceCase | null> => {
    try {
      const res = await api.patch<SuspiciousAttendanceCase>(
        `/attendance/suspicious/${id}`,
        { note },
      );
      return res.data;
    } catch {
      return null;
    }
  },
};
