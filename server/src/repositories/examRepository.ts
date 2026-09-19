import { getDatabase } from "../database/db.js";
import type { Exam, ExamResult } from "../models/index.js";

export const examRepository = {
  findById(id: string): Exam | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT e.*, g.name as group_name,
        (SELECT COUNT(*) FROM exam_results WHERE exam_id = e.id) as results_count
      FROM exams e
      JOIN groups g ON e.group_id = g.id
      WHERE e.id = ? AND (e.is_deleted IS NULL OR e.is_deleted = 0)
    `).get(id) as any;
    if (!row) return undefined;
    return this.mapExamRow(row);
  },

  listAll(filters?: { groupId?: string; subject?: string }): Exam[] {
    const db = getDatabase();
    const conditions: string[] = ["(e.is_deleted IS NULL OR e.is_deleted = 0)"];
    const values: any[] = [];

    if (filters?.groupId) {
      conditions.push("e.group_id = ?");
      values.push(filters.groupId);
    }
    if (filters?.subject) {
      conditions.push("e.subject = ?");
      values.push(filters.subject);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const rows = db.prepare(`
      SELECT e.*, g.name as group_name,
        (SELECT COUNT(*) FROM exam_results WHERE exam_id = e.id) as results_count
      FROM exams e
      JOIN groups g ON e.group_id = g.id
      ${where}
      ORDER BY e.exam_date DESC, e.created_at DESC
    `).all(...values) as any[];

    return rows.map((r) => this.mapExamRow(r));
  },

  create(exam: {
    id: string;
    group_id: string;
    name: string;
    subject: string;
    exam_date: string;
    max_score: number;
    notes?: string | null;
    sync_id?: string | null;
    created_at: string;
    updated_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO exams (id, group_id, name, subject, exam_date, max_score, notes, sync_id, created_at, updated_at)
      VALUES (@id, @group_id, @name, @subject, @exam_date, @max_score, @notes, @sync_id, @created_at, @updated_at)
    `).run({
      id: exam.id,
      group_id: exam.group_id,
      name: exam.name,
      subject: exam.subject,
      exam_date: exam.exam_date,
      max_score: exam.max_score,
      notes: exam.notes || null,
      sync_id: exam.sync_id || null,
      created_at: exam.created_at,
      updated_at: exam.updated_at,
    });
  },

  update(id: string, updates: Partial<any>): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };

    const allowed = ["group_id", "name", "subject", "exam_date", "max_score", "notes"];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        sets.push(`${key} = @${key}`);
        params[key] = updates[key];
      }
    }

    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();

    if (sets.length > 0) {
      db.prepare(`UPDATE exams SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  delete(id: string, deletedBy?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare("UPDATE exams SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?").run(now, deletedBy || null, id);
  },

  // EXAM RESULTS
  listResults(examId: string): ExamResult[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT r.*, s.full_name as student_name, s.student_code
      FROM exam_results r
      JOIN students s ON r.student_id = s.id
      WHERE r.exam_id = ?
      ORDER BY s.full_name ASC
    `).all(examId) as any[];

    return rows.map((r) => this.mapResultRow(r));
  },

  listAllResults(filters?: { examId?: string; studentId?: string }): ExamResult[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters?.examId) {
      conditions.push("r.exam_id = ?");
      values.push(filters.examId);
    }
    if (filters?.studentId) {
      conditions.push("r.student_id = ?");
      values.push(filters.studentId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT r.*, s.full_name as student_name, s.student_code
      FROM exam_results r
      JOIN students s ON r.student_id = s.id
      ${where}
      ORDER BY r.created_at DESC
    `).all(...values) as any[];

    return rows.map((r) => this.mapResultRow(r));
  },

  upsertResult(result: {
    id: string;
    exam_id: string;
    student_id: string;
    score: number | null;
    status: string;
    notes?: string | null;
    sync_id?: string | null;
    created_at: string;
    updated_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO exam_results (id, exam_id, student_id, score, status, notes, sync_id, created_at, updated_at)
      VALUES (@id, @exam_id, @student_id, @score, @status, @notes, @sync_id, @created_at, @updated_at)
      ON CONFLICT(exam_id, student_id) DO UPDATE SET
        score = excluded.score,
        status = excluded.status,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).run({
      id: result.id,
      exam_id: result.exam_id,
      student_id: result.student_id,
      score: result.score,
      status: result.status || "approved",
      notes: result.notes || null,
      sync_id: result.sync_id || null,
      created_at: result.created_at,
      updated_at: result.updated_at,
    });
  },

  findResultByStudent(examId: string, studentId: string): ExamResult | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT r.*, s.full_name as student_name, s.student_code
      FROM exam_results r
      JOIN students s ON r.student_id = s.id
      WHERE r.exam_id = ? AND r.student_id = ?
    `).get(examId, studentId) as any;
    if (!row) return undefined;
    return this.mapResultRow(row);
  },

  updateResult(id: string, updates: { score?: number | null; status?: string; notes?: string | null }): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };
    if (updates.score !== undefined) { sets.push("score = @score"); params.score = updates.score; }
    if (updates.status !== undefined) { sets.push("status = @status"); params.status = updates.status; }
    if (updates.notes !== undefined) { sets.push("notes = @notes"); params.notes = updates.notes; }
    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();
    if (sets.length > 0) {
      db.prepare(`UPDATE exam_results SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  findResultById(id: string): ExamResult | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT r.*, s.full_name as student_name, s.student_code
      FROM exam_results r
      JOIN students s ON r.student_id = s.id
      WHERE r.id = ?
    `).get(id) as any;
    if (!row) return undefined;
    return this.mapResultRow(row);
  },

  deleteResult(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM exam_results WHERE id = ?").run(id);
  },

  mapExamRow(row: any): Exam {
    return {
      id: row.id,
      groupId: row.group_id,
      groupName: row.group_name,
      name: row.name,
      subject: row.subject,
      examDate: row.exam_date,
      date: row.exam_date,
      maxScore: Number(row.max_score),
      notes: row.notes || undefined,
      resultsCount: row.results_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  mapResultRow(row: any): ExamResult {
    return {
      id: row.id,
      examId: row.exam_id,
      studentId: row.student_id,
      studentName: row.student_name,
      studentCode: row.student_code,
      score: row.score !== null ? Number(row.score) : null,
      status: row.status,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
