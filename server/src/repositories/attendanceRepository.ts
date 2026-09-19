import { getDatabase } from "../database/db.js";
import type { AttendanceRecord, AttendanceSession, SuspiciousAttendanceCase } from "../models/index.js";

export const attendanceRepository = {
  // SESSIONS
  findSessionById(id: string): AttendanceSession | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT s.*, g.name as group_name
      FROM attendance_sessions s
      JOIN groups g ON s.group_id = g.id
      WHERE s.id = ?
    `).get(id) as any;
    if (!row) return undefined;
    return this.mapSessionRow(row);
  },

  findOpenSessionForGroup(groupId: string, date?: string): AttendanceSession | undefined {
    const db = getDatabase();
    const today = date || new Date().toISOString().split("T")[0];
    const row = db.prepare(`
      SELECT s.*, g.name as group_name
      FROM attendance_sessions s
      JOIN groups g ON s.group_id = g.id
      WHERE s.group_id = ? AND s.status = 'open'
      ORDER BY s.created_at DESC
      LIMIT 1
    `).get(groupId) as any;
    if (!row) return undefined;
    return this.mapSessionRow(row);
  },

  listSessions(filters?: { groupId?: string; date?: string; status?: string }): AttendanceSession[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters?.groupId) {
      conditions.push("s.group_id = ?");
      values.push(filters.groupId);
    }
    if (filters?.date) {
      conditions.push("s.date = ?");
      values.push(filters.date);
    }
    if (filters?.status) {
      conditions.push("s.status = ?");
      values.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT s.*, g.name as group_name
      FROM attendance_sessions s
      JOIN groups g ON s.group_id = g.id
      ${where}
      ORDER BY s.date DESC, s.start_time DESC
    `).all(...values) as any[];

    return rows.map((r) => this.mapSessionRow(r));
  },

  createSession(session: {
    id: string;
    group_id: string;
    lesson_id?: string | null;
    date: string;
    start_time: string;
    end_time?: string | null;
    status: string;
    password?: string | null;
    qr_code?: string | null;
    opened_by?: string | null;
    sync_id?: string | null;
    created_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO attendance_sessions (id, group_id, lesson_id, date, start_time, end_time, status, password, qr_code, opened_by, sync_id, created_at)
      VALUES (@id, @group_id, @lesson_id, @date, @start_time, @end_time, @status, @password, @qr_code, @opened_by, @sync_id, @created_at)
    `).run({
      id: session.id,
      group_id: session.group_id,
      lesson_id: session.lesson_id || null,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time || null,
      status: session.status || "open",
      password: session.password || null,
      qr_code: session.qr_code || null,
      opened_by: session.opened_by || null,
      sync_id: session.sync_id || null,
      created_at: session.created_at,
    });
  },

  closeSession(id: string, closedBy?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const timeStr = now.split("T")[1].substring(0, 5);
    db.prepare("UPDATE attendance_sessions SET status = 'closed', end_time = ?, closed_by = ? WHERE id = ?").run(
      timeStr,
      closedBy || null,
      id
    );
  },

  // ATTENDANCE RECORDS
  findRecord(sessionId: string, studentId: string): AttendanceRecord | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT r.*, s.full_name as student_name, s.student_code, s.phone
      FROM attendance_records r
      JOIN students s ON r.student_id = s.id
      WHERE r.session_id = ? AND r.student_id = ?
    `).get(sessionId, studentId) as any;
    if (!row) return undefined;
    return this.mapRecordRow(row);
  },

  listRecords(filters: {
    sessionId?: string;
    groupId?: string;
    studentId?: string;
    date?: string;
    status?: string;
  }): AttendanceRecord[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.sessionId) {
      conditions.push("r.session_id = ?");
      values.push(filters.sessionId);
    }
    if (filters.groupId) {
      conditions.push("r.group_id = ?");
      values.push(filters.groupId);
    }
    if (filters.studentId) {
      conditions.push("r.student_id = ?");
      values.push(filters.studentId);
    }
    if (filters.status) {
      conditions.push("r.status = ?");
      values.push(filters.status);
    }
    if (filters.date) {
      conditions.push("DATE(r.created_at) = ?");
      values.push(filters.date);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT r.*, s.full_name as student_name, s.student_code, s.phone
      FROM attendance_records r
      JOIN students s ON r.student_id = s.id
      ${where}
      ORDER BY r.created_at DESC
    `).all(...values) as any[];

    return rows.map((r) => this.mapRecordRow(r));
  },

  recordAttendance(record: {
    id: string;
    session_id: string;
    student_id: string;
    group_id: string;
    lesson_id?: string | null;
    status: string;
    check_in_time?: string | null;
    check_out_time?: string | null;
    method: string;
    location_status?: string | null;
    device_id?: string | null;
    sync_id?: string | null;
    created_at: string;
    updated_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO attendance_records (
        id, session_id, student_id, group_id, lesson_id, status,
        check_in_time, check_out_time, method, location_status, device_id, sync_id, created_at, updated_at
      ) VALUES (
        @id, @session_id, @student_id, @group_id, @lesson_id, @status,
        @check_in_time, @check_out_time, @method, @location_status, @device_id, @sync_id, @created_at, @updated_at
      )
      ON CONFLICT(session_id, student_id) DO UPDATE SET
        status = excluded.status,
        check_in_time = COALESCE(attendance_records.check_in_time, excluded.check_in_time),
        check_out_time = COALESCE(excluded.check_out_time, attendance_records.check_out_time),
        method = excluded.method,
        location_status = excluded.location_status,
        device_id = excluded.device_id,
        updated_at = excluded.updated_at
    `).run({
      id: record.id,
      session_id: record.session_id,
      student_id: record.student_id,
      group_id: record.group_id,
      lesson_id: record.lesson_id || null,
      status: record.status || "present",
      check_in_time: record.check_in_time || null,
      check_out_time: record.check_out_time || null,
      method: record.method || "barcode",
      location_status: record.location_status || "allowed",
      device_id: record.device_id || null,
      sync_id: record.sync_id || null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
  },

  updateCheckOut(sessionId: string, studentId: string, checkOutTime: string): void {
    const db = getDatabase();
    db.prepare("UPDATE attendance_records SET check_out_time = ?, updated_at = ? WHERE session_id = ? AND student_id = ?").run(
      checkOutTime,
      new Date().toISOString(),
      sessionId,
      studentId
    );
  },

  findRecordById(id: string): AttendanceRecord | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT r.*, s.full_name as student_name, s.student_code, s.phone
      FROM attendance_records r
      JOIN students s ON r.student_id = s.id
      WHERE r.id = ?
    `).get(id) as any;
    if (!row) return undefined;
    return this.mapRecordRow(row);
  },

  updateRecord(id: string, updates: { status?: string; checkOutTime?: string | null; note?: string | null }): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };
    if (updates.status !== undefined) { sets.push("status = @status"); params.status = updates.status; }
    if (updates.checkOutTime !== undefined) { sets.push("check_out_time = @check_out_time"); params.check_out_time = updates.checkOutTime; }
    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();
    if (sets.length > 0) {
      db.prepare(`UPDATE attendance_records SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  deleteRecord(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM attendance_records WHERE id = ?").run(id);
  },

  /** Returns all records that have a check_out_time (i.e. checked-out students) */
  listCheckouts(filters?: { groupId?: string; studentId?: string; date?: string }): AttendanceRecord[] {
    const db = getDatabase();
    const conditions: string[] = ["r.check_out_time IS NOT NULL"];
    const values: any[] = [];
    if (filters?.groupId) { conditions.push("r.group_id = ?"); values.push(filters.groupId); }
    if (filters?.studentId) { conditions.push("r.student_id = ?"); values.push(filters.studentId); }
    if (filters?.date) { conditions.push("DATE(r.created_at) = ?"); values.push(filters.date); }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const rows = db.prepare(`
      SELECT r.*, s.full_name as student_name, s.student_code, s.phone
      FROM attendance_records r
      JOIN students s ON r.student_id = s.id
      ${where}
      ORDER BY r.check_out_time DESC
    `).all(...values) as any[];
    return rows.map((r) => this.mapRecordRow(r));
  },

  mapSessionRow(row: any): AttendanceSession {
    return {
      id: row.id,
      groupId: row.group_id,
      groupName: row.group_name,
      lessonId: row.lesson_id || undefined,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time || undefined,
      status: row.status,
      passwordEnabled: Boolean(row.password),
      qrCode: row.qr_code || undefined,
      openedBy: row.opened_by || undefined,
      closedBy: row.closed_by || undefined,
      openedAt: row.created_at,
      closedAt: row.status === "closed" ? row.end_time : undefined,
      createdAt: row.created_at,
    };
  },

  mapRecordRow(row: any): AttendanceRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      studentId: row.student_id,
      groupId: row.group_id,
      lessonId: row.lesson_id || undefined,
      student: row.student_name,
      studentName: row.student_name,
      studentCode: row.student_code,
      phone: row.phone || undefined,
      status: row.status,
      checkedInAt: row.check_in_time || undefined,
      checkedOutAt: row.check_out_time || undefined,
      method: row.method,
      locationStatus: row.location_status,
      deviceId: row.device_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  listSuspiciousCases(): any[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM suspicious_attendance ORDER BY created_at DESC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      attendanceIds: JSON.parse(r.attendance_ids || "[]"),
      studentIds: JSON.parse(r.student_ids || "[]"),
      studentNames: JSON.parse(r.student_names || "[]"),
      reason: r.reason,
      deviceId: r.device_id || undefined,
      status: r.status,
      note: r.note || undefined,
      detectedAt: r.detected_at,
      createdAt: r.created_at,
    }));
  },

  findSuspiciousCaseById(id: string): any {
    const db = getDatabase();
    const r = db.prepare("SELECT * FROM suspicious_attendance WHERE id = ?").get(id) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      attendanceIds: JSON.parse(r.attendance_ids || "[]"),
      studentIds: JSON.parse(r.student_ids || "[]"),
      studentNames: JSON.parse(r.student_names || "[]"),
      reason: r.reason,
      deviceId: r.device_id || undefined,
      status: r.status,
      note: r.note || undefined,
      detectedAt: r.detected_at,
      createdAt: r.created_at,
    };
  },

  createSuspiciousCase(data: any): any {
    const db = getDatabase();
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO suspicious_attendance (id, attendance_ids, student_ids, student_names, reason, device_id, status, note, detected_at, created_at)
      VALUES (@id, @attendance_ids, @student_ids, @student_names, @reason, @device_id, @status, @note, @detected_at, @created_at)
    `).run({
      id,
      attendance_ids: JSON.stringify(data.attendanceIds || data.attendance_ids || []),
      student_ids: JSON.stringify(data.studentIds || data.student_ids || []),
      student_names: JSON.stringify(data.studentNames || data.student_names || []),
      reason: data.reason || "اشتباه في تسجيل الحضور",
      device_id: data.deviceId || data.device_id || null,
      status: data.status || "pending",
      note: data.note || null,
      detected_at: data.detectedAt || data.detected_at || now,
      created_at: now,
    });
    return this.findSuspiciousCaseById(id);
  },

  updateSuspiciousCase(id: string, updates: { status?: string; note?: string }): any {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };
    if (updates.status !== undefined) { sets.push("status = @status"); params.status = updates.status; }
    if (updates.note !== undefined) { sets.push("note = @note"); params.note = updates.note; }
    if (sets.length > 0) {
      db.prepare(`UPDATE suspicious_attendance SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
    return this.findSuspiciousCaseById(id);
  },
};
