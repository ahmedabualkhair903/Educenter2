import { getDatabase } from "../database/db.js";

export interface LessonRow {
  id: string;
  groupId: string;
  group: string;
  title: string;
  subject: string;
  teacherId?: string;
  teacher: string;
  date: string;
  time: string;
  endTime?: string | null;
  duration: number;
  room: string;
  students: number;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const SESSION_SELECT = `
  SELECT 
    l.*,
    g.name as group_name,
    g.subject as group_subject,
    g.room as group_room,
    t.name as group_teacher_name,
    lt.name as lesson_teacher_name,
    (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = l.group_id AND sg.status = 'active') as students_count
  FROM lessons l
  JOIN groups g ON l.group_id = g.id
  LEFT JOIN teachers t ON g.teacher_id = t.id
  LEFT JOIN teachers lt ON l.teacher_id = lt.id
`;

export const lessonRepository = {
  listAll(filters?: { groupId?: string }): LessonRow[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters?.groupId) {
      conditions.push("l.group_id = ?");
      values.push(filters.groupId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      ${SESSION_SELECT}
      ${where}
      ORDER BY l.date DESC, l.start_time DESC
    `).all(...values) as any[];

    return rows.map((r) => this.mapRow(r));
  },

  findById(id: string): LessonRow | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      ${SESSION_SELECT}
      WHERE l.id = ?
    `).get(id) as any;

    if (!row) return undefined;
    return this.mapRow(row);
  },

  create(data: {
    id: string;
    groupId: string;
    title?: string;
    subject?: string | null;
    teacherId?: string | null;
    room?: string | null;
    date: string;
    time: string;
    endTime?: string;
    status?: string;
    notes?: string;
    syncId?: string;
    createdAt: string;
    updatedAt: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO lessons (id, group_id, title, subject, teacher_id, room, date, start_time, end_time, status, sync_id, created_at, updated_at)
      VALUES (@id, @group_id, @title, @subject, @teacher_id, @room, @date, @start_time, @end_time, @status, @sync_id, @created_at, @updated_at)
    `).run({
      id: data.id,
      group_id: data.groupId,
      title: data.title || "حصة درس",
      subject: data.subject || null,
      teacher_id: data.teacherId || null,
      room: data.room || null,
      date: data.date,
      start_time: data.time,
      end_time: data.endTime || null,
      status: data.status || "scheduled",
      sync_id: data.syncId || null,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    });
  },

  update(id: string, updates: Partial<LessonRow>): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };

    if (updates.groupId !== undefined) { sets.push("group_id = @group_id"); params.group_id = updates.groupId; }
    if (updates.title !== undefined) { sets.push("title = @title"); params.title = updates.title; }
    if (updates.subject !== undefined) { sets.push("subject = @subject"); params.subject = updates.subject || null; }
    if (updates.teacherId !== undefined) { sets.push("teacher_id = @teacher_id"); params.teacher_id = updates.teacherId || null; }
    if (updates.room !== undefined) { sets.push("room = @room"); params.room = updates.room || null; }
    if (updates.date !== undefined) { sets.push("date = @date"); params.date = updates.date; }
    if (updates.time !== undefined) { sets.push("start_time = @start_time"); params.start_time = updates.time; }
    else if ((updates as any).startTime !== undefined) { sets.push("start_time = @start_time"); params.start_time = (updates as any).startTime; }
    if (updates.endTime !== undefined) { sets.push("end_time = @end_time"); params.end_time = updates.endTime || null; }
    if (updates.status !== undefined) { sets.push("status = @status"); params.status = updates.status; }

    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();

    if (sets.length > 0) {
      db.prepare(`UPDATE lessons SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  delete(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM lessons WHERE id = ?").run(id);
  },

  /**
   * Time-driven status transitions (run every minute by scheduler):
   * scheduled -> in_progress when started, -> completed when ended.
   * Cancelled lessons are never touched. NULL end_time = +60 minutes.
   */
  refreshStatuses(now?: Date): { ongoing: number; completed: number } {
    const db = getDatabase();
    const current = now ?? new Date();
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`;
    const clock = `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;

    const ongoing = db.prepare(`
      UPDATE lessons
      SET status = 'in_progress', updated_at = ?
      WHERE status = 'scheduled'
        AND date = ?
        AND start_time <= ?
        AND COALESCE(end_time, time(start_time, '+60 minutes')) > ?
    `).run(current.toISOString(), today, clock, clock);

    const completed = db.prepare(`
      UPDATE lessons
      SET status = 'completed', updated_at = ?
      WHERE status IN ('scheduled', 'in_progress')
        AND (
          date < ?
          OR (date = ? AND COALESCE(end_time, time(start_time, '+60 minutes')) <= ?)
        )
    `).run(current.toISOString(), today, today, clock);

    return {
      ongoing: Number(ongoing.changes) || 0,
      completed: Number(completed.changes) || 0,
    };
  },

  mapRow(row: any): LessonRow {
    let status = row.status || "upcoming";
    if (status === "scheduled") status = "upcoming";
    if (status === "in_progress") status = "ongoing";

    return {
      id: row.id,
      groupId: row.group_id,
      group: row.group_name || "",
      title: row.title || row.group_name || "",
      subject: row.subject || row.group_subject || "",
      teacherId: row.teacher_id || undefined,
      teacher: row.lesson_teacher_name || row.group_teacher_name || "",
      date: row.date,
      time: row.start_time,
      endTime: row.end_time || undefined,
      duration: calcDurationMinutes(row.start_time, row.end_time),
      room: row.room || row.group_room || "",
      students: row.students_count || 0,
      status: status,
      notes: row.notes || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

function calcDurationMinutes(startTime: string, endTime: string): number {
  const parse = (value: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec((value || "").trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const start = parse(startTime);
  const end = parse(endTime);

  if (start === null || end === null || end <= start) {
    return 60;
  }

  return end - start;
}
