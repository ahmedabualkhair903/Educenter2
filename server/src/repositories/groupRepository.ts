import { getDatabase } from "../database/db.js";
import type { Group, GroupSchedule, Student } from "../models/index.js";
import { studentRepository } from "./studentRepository.js";

export const groupRepository = {
  findById(id: string): Group | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT g.*, t.name as teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.is_deleted = 0) as student_count
      FROM groups g
      LEFT JOIN teachers t ON g.teacher_id = t.id
      WHERE g.id = ? AND g.is_deleted = 0
    `).get(id) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  },

  listAll(filters?: { grade?: string; status?: string; teacherId?: string }): Group[] {
    const db = getDatabase();
    const conditions = ["g.is_deleted = 0"];
    const values: any[] = [];

    if (filters?.grade) {
      conditions.push("g.grade = ?");
      values.push(filters.grade);
    }
    if (filters?.status) {
      conditions.push("g.status = ?");
      values.push(filters.status);
    }
    if (filters?.teacherId) {
      conditions.push("g.teacher_id = ?");
      values.push(filters.teacherId);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const query = `
      SELECT g.*, t.name as teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.is_deleted = 0) as student_count
      FROM groups g
      LEFT JOIN teachers t ON g.teacher_id = t.id
      ${where}
      ORDER BY g.grade ASC, g.name ASC
    `;

    const rows = db.prepare(query).all(...values) as any[];
    return rows.map((r) => this.mapRow(r));
  },

  create(group: {
    id: string;
    name: string;
    teacher_id?: string | null;
    subject: string;
    grade: string;
    room?: string | null;
    capacity: number;
    schedule: string;
    status: string;
    sync_id?: string | null;
    created_at: string;
    updated_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO groups (id, name, teacher_id, subject, grade, room, capacity, schedule, status, sync_id, created_at, updated_at)
      VALUES (@id, @name, @teacher_id, @subject, @grade, @room, @capacity, @schedule, @status, @sync_id, @created_at, @updated_at)
    `).run({
      id: group.id,
      name: group.name,
      teacher_id: group.teacher_id || null,
      subject: group.subject,
      grade: group.grade,
      room: group.room || null,
      capacity: group.capacity || 30,
      schedule: group.schedule || "[]",
      status: group.status || "active",
      sync_id: group.sync_id || null,
      created_at: group.created_at,
      updated_at: group.updated_at,
    });
  },

  update(id: string, updates: Partial<any>): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };

    const allowed = ["name", "teacher_id", "subject", "grade", "room", "capacity", "schedule", "status"];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        sets.push(`${key} = @${key}`);
        params[key] = updates[key];
      }
    }

    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();

    if (sets.length > 0) {
      db.prepare(`UPDATE groups SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  softDelete(id: string, deletedBy?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare("UPDATE groups SET is_deleted = 1, deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ?").run(
      now,
      deletedBy || null,
      now,
      id
    );
  },

  listStudentsInGroup(groupId: string): Student[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT s.*, g.name as group_name
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE (s.group_id = ? OR s.id IN (SELECT student_id FROM student_groups WHERE group_id = ? AND status = 'active'))
        AND s.is_deleted = 0
      ORDER BY s.full_name ASC
    `).all(groupId, groupId) as any[];

    return rows.map((r) => studentRepository.mapRowToStudent(r));
  },

  enrollStudent(studentId: string, groupId: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = `${studentId}_${groupId}`;

    db.transaction(() => {
      // Update primary group_id on student
      db.prepare("UPDATE students SET group_id = ?, updated_at = ? WHERE id = ?").run(groupId, now, studentId);

      // Upsert in student_groups
      db.prepare(`
        INSERT INTO student_groups (id, student_id, group_id, join_date, status, created_at)
        VALUES (?, ?, ?, ?, 'active', ?)
        ON CONFLICT(student_id, group_id) DO UPDATE SET
          status = 'active',
          leave_date = NULL
      `).run(id, studentId, groupId, now, now);
    })();
  },

  removeStudentFromGroup(studentId: string, groupId: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare("UPDATE students SET group_id = NULL, updated_at = ? WHERE id = ? AND group_id = ?").run(now, studentId, groupId);
      db.prepare("UPDATE student_groups SET status = 'left', leave_date = ? WHERE student_id = ? AND group_id = ?").run(now, studentId, groupId);
    })();
  },

  mapRow(row: any): Group {
    let schedule: GroupSchedule[] = [];
    try {
      schedule = row.schedule ? JSON.parse(row.schedule) : [];
    } catch {
      schedule = [];
    }

    return {
      id: row.id,
      name: row.name,
      teacherId: row.teacher_id || undefined,
      teacher: row.teacher_name || undefined,
      subject: row.subject,
      grade: row.grade,
      room: row.room || undefined,
      capacity: row.capacity,
      maxStudents: row.capacity,
      schedule,
      status: row.status,
      studentCount: row.student_count || 0,
      isDeleted: Boolean(row.is_deleted),
      deletedAt: row.deleted_at || undefined,
      syncId: row.sync_id || undefined,
      syncStatus: row.sync_status || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
