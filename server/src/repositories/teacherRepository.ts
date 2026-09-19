import { getDatabase } from "../database/db.js";
import type { Teacher } from "../models/index.js";

export const teacherRepository = {
  findById(id: string): Teacher | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM teachers WHERE id = ? AND is_deleted = 0").get(id) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  },

  listAll(): Teacher[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM teachers WHERE is_deleted = 0 ORDER BY name ASC").all() as any[];
    return rows.map((r) => this.mapRow(r));
  },

  create(teacher: {
    id: string;
    name: string;
    phone?: string | null;
    subject: string;
    notes?: string | null;
    status: string;
    sync_id?: string | null;
    created_at: string;
    updated_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO teachers (id, name, phone, subject, notes, status, sync_id, created_at, updated_at)
      VALUES (@id, @name, @phone, @subject, @notes, @status, @sync_id, @created_at, @updated_at)
    `).run({
      id: teacher.id,
      name: teacher.name,
      phone: teacher.phone || null,
      subject: teacher.subject,
      notes: teacher.notes || null,
      status: teacher.status || "active",
      sync_id: teacher.sync_id || null,
      created_at: teacher.created_at,
      updated_at: teacher.updated_at,
    });
  },

  update(id: string, updates: Partial<Teacher>): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };

    if (updates.name !== undefined) {
      sets.push("name = @name");
      params.name = updates.name;
    }
    if (updates.phone !== undefined) {
      sets.push("phone = @phone");
      params.phone = updates.phone;
    }
    if (updates.subject !== undefined) {
      sets.push("subject = @subject");
      params.subject = updates.subject;
    }
    if (updates.notes !== undefined) {
      sets.push("notes = @notes");
      params.notes = updates.notes;
    }
    if (updates.status !== undefined) {
      sets.push("status = @status");
      params.status = updates.status;
    }

    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();

    if (sets.length > 0) {
      db.prepare(`UPDATE teachers SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  softDelete(id: string, deletedBy?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare("UPDATE teachers SET is_deleted = 1, deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ?").run(
      now,
      deletedBy || null,
      now,
      id
    );
  },

  getTeacherStats(teacherId: string): {
    groupsCount: number;
    studentsCount: number;
    activeSessionsCount: number;
  } {
    const db = getDatabase();
    const groupsCountRow = db.prepare("SELECT COUNT(*) as count FROM groups WHERE teacher_id = ? AND is_deleted = 0").get(teacherId) as { count: number };
    
    const studentsCountRow = db.prepare(`
      SELECT COUNT(DISTINCT s.id) as count
      FROM students s
      JOIN groups g ON s.group_id = g.id
      WHERE g.teacher_id = ? AND s.is_deleted = 0
    `).get(teacherId) as { count: number };

    const sessionsRow = db.prepare(`
      SELECT COUNT(DISTINCT sess.id) as count
      FROM attendance_sessions sess
      JOIN groups g ON sess.group_id = g.id
      WHERE g.teacher_id = ? AND sess.status = 'open'
    `).get(teacherId) as { count: number };

    return {
      groupsCount: groupsCountRow?.count || 0,
      studentsCount: studentsCountRow?.count || 0,
      activeSessionsCount: sessionsRow?.count || 0,
    };
  },

  mapRow(row: any): Teacher {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone || undefined,
      subject: row.subject,
      notes: row.notes || undefined,
      status: row.status,
      isDeleted: Boolean(row.is_deleted),
      deletedAt: row.deleted_at || undefined,
      deletedBy: row.deleted_by || undefined,
      syncId: row.sync_id || undefined,
      syncStatus: row.sync_status || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
