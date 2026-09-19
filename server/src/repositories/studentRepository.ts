import { getDatabase } from "../database/db.js";
import type { Student, StudentCustomFieldDefinition, StudentFinancialSummary } from "../models/index.js";

export interface StudentFilters {
  search?: string;
  grade?: string;
  groupId?: string;
  teacherId?: string;
  status?: string;
  paymentStatus?: "paid" | "partial" | "unpaid";
  page?: number;
  limit?: number;
}

export const studentRepository = {
  findById(id: string, includeDeleted = false): Student | undefined {
    const db = getDatabase();
    const query = `
      SELECT s.*, g.name as group_name
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE s.id = ? ${includeDeleted ? "" : "AND s.is_deleted = 0"}
    `;
    const row = db.prepare(query).get(id) as any;
    if (!row) return undefined;
    return this.mapRowToStudent(row);
  },

  findByCode(code: string): Student | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT s.*, g.name as group_name
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE (s.student_code = ? COLLATE NOCASE OR s.barcode = ?) AND s.is_deleted = 0
    `).get(code, code) as any;
    if (!row) return undefined;
    return this.mapRowToStudent(row);
  },

  findByPhone(phone: string): Student[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT s.*, g.name as group_name
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE (s.phone = ? OR s.guardian_phone = ?) AND s.is_deleted = 0
    `).all(phone, phone) as any[];
    return rows.map((r) => this.mapRowToStudent(r));
  },

  findPossibleDuplicates(params: {
    studentCode?: string;
    phone?: string;
    guardianPhone?: string;
    name?: string;
    excludeId?: string;
  }): Student[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.studentCode) {
      conditions.push("(s.student_code = ? COLLATE NOCASE OR s.barcode = ?)");
      values.push(params.studentCode, params.studentCode);
    }
    if (params.phone && params.phone.trim().length >= 6) {
      conditions.push("(s.phone = ? OR s.guardian_phone = ?)");
      values.push(params.phone, params.phone);
    }
    if (params.guardianPhone && params.guardianPhone.trim().length >= 6) {
      conditions.push("(s.guardian_phone = ? OR s.phone = ?)");
      values.push(params.guardianPhone, params.guardianPhone);
    }
    if (params.name && params.phone && params.name.trim().length >= 3) {
      conditions.push("(s.full_name LIKE ? AND (s.phone = ? OR s.guardian_phone = ?))");
      values.push(`%${params.name.trim()}%`, params.phone, params.phone);
    }

    if (conditions.length === 0) return [];

    let sql = `
      SELECT s.*, g.name as group_name
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE s.is_deleted = 0 AND (${conditions.join(" OR ")})
    `;

    if (params.excludeId) {
      sql += " AND s.id != ?";
      values.push(params.excludeId);
    }

    sql += " LIMIT 10";

    const rows = db.prepare(sql).all(...values) as any[];
    return rows.map((r) => this.mapRowToStudent(r));
  },

  list(filters: StudentFilters): { students: Student[]; total: number } {
    const db = getDatabase();
    const conditions: string[] = ["s.is_deleted = 0"];
    const values: any[] = [];

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(`(
        s.full_name LIKE ? OR 
        s.student_code LIKE ? OR 
        s.phone LIKE ? OR 
        s.guardian_phone LIKE ? OR 
        s.barcode LIKE ? OR 
        s.guardian_name LIKE ?
      )`);
      values.push(term, term, term, term, term, term);
    }

    if (filters.grade) {
      conditions.push("s.grade = ?");
      values.push(filters.grade);
    }

    if (filters.groupId) {
      conditions.push("s.group_id = ?");
      values.push(filters.groupId);
    }

    if (filters.teacherId) {
      // الطلاب المرتبطون بالمدرس: عبر مجموعتهم الأساسية أو عضوية نشطة
      // في أي مجموعة يشرف عليها (student_groups).
      conditions.push(`(
        s.group_id IN (SELECT g.id FROM groups g WHERE g.teacher_id = ? AND g.is_deleted = 0)
        OR s.id IN (
          SELECT sg.student_id FROM student_groups sg
          JOIN groups g ON g.id = sg.group_id
          WHERE g.teacher_id = ? AND sg.status = 'active' AND g.is_deleted = 0
        )
      )`);
      values.push(filters.teacherId, filters.teacherId);
    }

    if (filters.status) {
      conditions.push("s.status = ?");
      values.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM students s ${whereClause}`).get(...values) as { total: number };
    const total = countRow.total;

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(200, Math.max(1, filters.limit || 50));
    const offset = (page - 1) * limit;

    const query = `
      SELECT s.*, g.name as group_name
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(query).all(...values, limit, offset) as any[];
    const students = rows.map((r) => this.mapRowToStudent(r));

    return { students, total };
  },

  searchFast(queryStr: string, limit = 20): Student[] {
    const db = getDatabase();
    const term = `%${queryStr.trim()}%`;
    const rows = db.prepare(`
      SELECT s.*, g.name as group_name
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE s.is_deleted = 0 AND (
        s.full_name LIKE ? OR 
        s.student_code LIKE ? OR 
        s.phone LIKE ? OR 
        s.guardian_phone LIKE ? OR 
        s.barcode = ? OR 
        s.guardian_barcode = ?
      )
      ORDER BY s.created_at DESC
      LIMIT ?
    `).all(term, term, term, term, queryStr.trim(), queryStr.trim(), limit) as any[];

    return rows.map((r) => this.mapRowToStudent(r));
  },

  getFinancialSummary(studentId: string): StudentFinancialSummary {
    const db = getDatabase();
    // Sum fees required
    const feeRow = db.prepare(`
      SELECT COALESCE(SUM(amount_after_discount), 0) as total_required
      FROM fees
      WHERE student_id = ?
    `).get(studentId) as { total_required: number };

    // Sum payments paid
    const payRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM payments
      WHERE student_id = ?
    `).get(studentId) as { total_paid: number };

    const totalRequired = feeRow ? feeRow.total_required : 0;
    const paid = payRow ? payRow.total_paid : 0;
    const remaining = Math.max(0, totalRequired - paid);

    let status: "paid" | "partial" | "unpaid" = "unpaid";
    if (totalRequired === 0 || paid >= totalRequired) {
      status = "paid";
    } else if (paid > 0) {
      status = "partial";
    }

    return {
      totalRequired,
      paid,
      remaining,
      status,
    };
  },

  getNextStudentCode(): string {
    const db = getDatabase();
    const year = new Date().getFullYear();
    const prefix = `STU-${year}-`;

    // Year-scoped sequence: STU-YYYY-XXXX (e.g. STU-2026-0001).
    // Parse the trailing numeric part after the last '-' in JS so both
    // legacy codes (STU-000001) and new codes (STU-2026-XXXX) coexist safely.
    const rows = db.prepare(`
      SELECT student_code
      FROM students
      WHERE student_code LIKE ?
    `).all(`${prefix}%`) as { student_code: string }[];

    let maxNum = 0;
    for (const r of rows) {
      const code: string = r.student_code || "";
      const tail = code.slice(prefix.length);
      const num = Number.parseInt(tail, 10);
      if (Number.isFinite(num) && num > maxNum) {
        maxNum = num;
      }
    }

    let nextNum = maxNum + 1;
    let code = `${prefix}${nextNum.toString().padStart(4, "0")}`;

    // Uniqueness guard: loop until a free code is found.
    // The UNIQUE constraint on student_code/barcode is the final arbiter
    // (see insert retry in studentService for race conditions).
    while (db.prepare("SELECT 1 FROM students WHERE student_code = ? OR barcode = ?").get(code, code)) {
      nextNum++;
      code = `${prefix}${nextNum.toString().padStart(4, "0")}`;
    }

    return code;
  },

  create(student: {
    id: string;
    student_code: string;
    full_name: string;
    phone?: string | null;
    guardian_name: string;
    guardian_phone: string;
    gender?: string | null;
    birth_date?: string | null;
    school_name?: string | null;
    school_grade?: string | null;
    grade: string;
    group_id?: string | null;
    address?: string | null;
    notes?: string | null;
    status: string;
    barcode: string;
    guardian_barcode?: string | null;
    custom_fields?: string;
    created_by?: string | null;
    sync_id?: string | null;
    created_at: string;
    updated_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO students (
        id, student_code, full_name, phone, guardian_name, guardian_phone,
        gender, birth_date, school_name, school_grade, grade, group_id,
        address, notes, status, barcode, guardian_barcode, custom_fields,
        created_by, sync_id, created_at, updated_at
      ) VALUES (
        @id, @student_code, @full_name, @phone, @guardian_name, @guardian_phone,
        @gender, @birth_date, @school_name, @school_grade, @grade, @group_id,
        @address, @notes, @status, @barcode, @guardian_barcode, @custom_fields,
        @created_by, @sync_id, @created_at, @updated_at
      )
    `).run({
      id: student.id,
      student_code: student.student_code,
      full_name: student.full_name,
      phone: student.phone || null,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone,
      gender: student.gender || "male",
      birth_date: student.birth_date || null,
      school_name: student.school_name || null,
      school_grade: student.school_grade || null,
      grade: student.grade,
      group_id: student.group_id || null,
      address: student.address || null,
      notes: student.notes || null,
      status: student.status || "active",
      barcode: student.barcode,
      guardian_barcode: student.guardian_barcode || null,
      custom_fields: student.custom_fields || "[]",
      created_by: student.created_by || null,
      sync_id: student.sync_id || null,
      created_at: student.created_at,
      updated_at: student.updated_at,
    });
  },

  update(id: string, fields: Partial<any>): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };

    const allowed = [
      "student_code", "full_name", "phone", "guardian_name", "guardian_phone",
      "gender", "birth_date", "school_name", "school_grade", "grade", "group_id",
      "address", "notes", "status", "barcode", "guardian_barcode", "custom_fields"
    ];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = @${key}`);
        params[key] = fields[key];
      }
    }

    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();

    if (sets.length > 0) {
      db.prepare(`UPDATE students SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  softDelete(id: string, deletedBy?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE students 
      SET is_deleted = 1, deleted_at = ?, deleted_by = ?, updated_at = ?
      WHERE id = ?
    `).run(now, deletedBy || null, now, id);
  },

  // Custom Field Definitions
  listCustomFieldDefinitions(): StudentCustomFieldDefinition[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM student_custom_field_definitions WHERE active = 1 ORDER BY sort_order ASC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      type: r.type,
      required: Boolean(r.required),
      options: r.options ? JSON.parse(r.options) : [],
      active: Boolean(r.active),
      order: r.sort_order,
      created_at: r.created_at,
    }));
  },

  createCustomFieldDefinition(def: StudentCustomFieldDefinition): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO student_custom_field_definitions (id, label, type, required, options, active, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      def.id,
      def.label,
      def.type,
      def.required ? 1 : 0,
      JSON.stringify(def.options || []),
      def.active ? 1 : 0,
      def.order || 0,
      new Date().toISOString()
    );
  },

  deleteCustomFieldDefinition(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM student_custom_field_definitions WHERE id = ?").run(id);
  },

  mapRowToStudent(row: any): Student {
    let customFields = [];
    try {
      customFields = row.custom_fields ? JSON.parse(row.custom_fields) : [];
    } catch {
      customFields = [];
    }

    const financial = this.getFinancialSummary(row.id);

    return {
      id: row.id,
      studentId: row.student_code,
      name: row.full_name,
      phone: row.phone || undefined,
      guardianName: row.guardian_name,
      guardianPhone: row.guardian_phone,
      gender: row.gender || undefined,
      birthDate: row.birth_date || undefined,
      schoolName: row.school_name || undefined,
      schoolGrade: row.school_grade || undefined,
      grade: row.grade,
      groupId: row.group_id || undefined,
      groupName: row.group_name || undefined,
      address: row.address || undefined,
      notes: row.notes || undefined,
      status: row.status as any,
      barcode: row.barcode,
      guardianBarcode: row.guardian_barcode || undefined,
      customFields,
      financial,
      isDeleted: Boolean(row.is_deleted),
      deletedAt: row.deleted_at || undefined,
      deletedBy: row.deleted_by || undefined,
      createdBy: row.created_by || undefined,
      syncId: row.sync_id || undefined,
      syncStatus: row.sync_status || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
