import { getDatabase } from "../database/db.js";
import type { Notification } from "../models/index.js";

export const notificationRepository = {
  findById(id: string): Notification | undefined {
    const db = getDatabase();
    return db.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as Notification | undefined;
  },

  create(data: {
    id: string;
    student_id: string | null;
    recipient_phone: string;
    title?: string | null;
    type: string;
    message: string;
    status: string;
    scheduled_at: string;
    attachment_data?: string | null;
    attachment_name?: string | null;
    attachment_mime?: string | null;
    attachment_size?: number | null;
    whatsapp_account_id?: string | null;
    sync_id: string;
    created_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO notifications (id, student_id, recipient_phone, title, type, message, status, retry_count, scheduled_at, attachment_data, attachment_name, attachment_mime, attachment_size, whatsapp_account_id, sync_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data.id, data.student_id, data.recipient_phone, data.title || null, data.type, data.message, data.status, data.scheduled_at, data.attachment_data || null, data.attachment_name || null, data.attachment_mime || null, data.attachment_size ?? null, data.whatsapp_account_id || null, data.sync_id, data.created_at);
  },

  list(filters?: { status?: string; type?: string; studentId?: string; limit?: number }): any[] {
    const db = getDatabase();
    let query = `
      SELECT n.*, s.full_name as student_name
      FROM notifications n
      LEFT JOIN students s ON n.student_id = s.id
      WHERE 1=1`;
    const params: any[] = [];

    if (filters?.status) {
      query += " AND n.status = ?";
      params.push(filters.status);
    }
    if (filters?.type) {
      query += " AND n.type = ?";
      params.push(filters.type);
    }
    if (filters?.studentId) {
      query += " AND n.student_id = ?";
      params.push(filters.studentId);
    }

    query += " ORDER BY n.created_at DESC";

    if (filters?.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params) as any[];
  },

  update(id: string, updates: { title?: string | null; message?: string; recipient_phone?: string; status?: string; type?: string; scheduled_at?: string; attachment_data?: string | null; attachment_name?: string | null; attachment_mime?: string | null; attachment_size?: number | null; whatsapp_account_id?: string | null }): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };

    if (updates.title !== undefined) {
      sets.push("title = @title");
      params.title = updates.title;
    }
    if (updates.message !== undefined) {
      sets.push("message = @message");
      params.message = updates.message;
    }
    if (updates.recipient_phone !== undefined) {
      sets.push("recipient_phone = @recipient_phone");
      params.recipient_phone = updates.recipient_phone;
    }
    if (updates.status !== undefined) {
      sets.push("status = @status");
      params.status = updates.status;
    }
    if (updates.type !== undefined) {
      sets.push("type = @type");
      params.type = updates.type;
    }
    if (updates.scheduled_at !== undefined) {
      sets.push("scheduled_at = @scheduled_at");
      params.scheduled_at = updates.scheduled_at;
    }
    if (updates.attachment_data !== undefined) {
      sets.push("attachment_data = @attachment_data");
      params.attachment_data = updates.attachment_data;
    }
    if (updates.attachment_name !== undefined) {
      sets.push("attachment_name = @attachment_name");
      params.attachment_name = updates.attachment_name;
    }
    if (updates.attachment_mime !== undefined) {
      sets.push("attachment_mime = @attachment_mime");
      params.attachment_mime = updates.attachment_mime;
    }
    if (updates.attachment_size !== undefined) {
      sets.push("attachment_size = @attachment_size");
      params.attachment_size = updates.attachment_size;
    }
    if (updates.whatsapp_account_id !== undefined) {
      sets.push("whatsapp_account_id = @whatsapp_account_id");
      params.whatsapp_account_id = updates.whatsapp_account_id;
    }

    if (sets.length > 0) {
      db.prepare(`UPDATE notifications SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  delete(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM notifications WHERE id = ?").run(id);
  },

  retryFailed(): number {
    const db = getDatabase();
    const result = db.prepare("UPDATE notifications SET status = 'pending', retry_count = retry_count + 1 WHERE status = 'failed' AND retry_count < 5").run();
    return result.changes;
  },

  getPendingQueue(limit: number = 10): Notification[] {
    const db = getDatabase();
    // scheduled_at يُخزن بصيغة ISO (…T…Z) بينما datetime('now') بصيغة
    // SQLite (مسافة بدون T) — المقارنة النصية المباشرة لا تلتقي أبداً
    // (‎'T' > ' ') فتتجمد الرسائل في pending. datetime() على الطرفين
    // يوحّد الصيغة ويجعل المقارنة زمنية صحيحة.
    // ملاحظة: تُرجع الصفوف mapped إلى واجهة Notification (camelCase)
    // لأن الـ worker يقرأ recipientPhone/message — الصف الخام snake_case.
    const rows = db.prepare(
      "SELECT * FROM notifications WHERE status = 'pending' AND datetime(scheduled_at) <= datetime('now') ORDER BY scheduled_at ASC LIMIT ?"
    ).all(limit) as any[];
    return rows.map((row) => ({
      id: row.id,
      studentId: row.student_id || undefined,
      recipientPhone: row.recipient_phone,
      type: row.type,
      message: row.message,
      status: row.status,
      retryCount: row.retry_count || 0,
      scheduledAt: row.scheduled_at,
      sentAt: row.sent_at || undefined,
      error: row.error || undefined,
      createdAt: row.created_at,
      whatsappAccountId: row.whatsapp_account_id || undefined,
    })) as Notification[];
  },

  updateStatus(id: string, status: string, error?: string): void {
    const db = getDatabase();
    if (error) {
      db.prepare("UPDATE notifications SET status = ?, error = ?, sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE sent_at END WHERE id = ?").run(status, error, status, id);
    } else {
      db.prepare("UPDATE notifications SET status = ?, sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE sent_at END WHERE id = ?").run(status, status, id);
    }
  },
};
