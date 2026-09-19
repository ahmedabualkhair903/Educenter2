import { getDatabase } from "../database/db.js";
import type { Payment } from "../models/index.js";

export const paymentRepository = {
  findById(id: string): Payment | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT p.*, s.full_name as student_name, s.student_code, u.name as received_by_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN users u ON p.received_by = u.id
      WHERE p.id = ?
    `).get(id) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  },

  findByIdempotencyKey(key: string): Payment | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT p.*, s.full_name as student_name, s.student_code, u.name as received_by_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN users u ON p.received_by = u.id
      WHERE p.idempotency_key = ?
    `).get(key) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  },

  list(filters?: {
    studentId?: string;
    feeId?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    receivedBy?: string;
    limit?: number;
  }): Payment[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters?.studentId) {
      conditions.push("p.student_id = ?");
      values.push(filters.studentId);
    }
    if (filters?.feeId) {
      conditions.push("p.fee_id = ?");
      values.push(filters.feeId);
    }
    if (filters?.paymentMethod) {
      conditions.push("p.payment_method = ?");
      values.push(filters.paymentMethod);
    }
    if (filters?.receivedBy) {
      conditions.push("p.received_by = ?");
      values.push(filters.receivedBy);
    }
    if (filters?.startDate) {
      conditions.push("p.payment_date >= ?");
      values.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push("p.payment_date <= ?");
      values.push(filters.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    // Parameterized LIMIT (previously string-interpolated). Clamped to a sane
    // range; behavior identical for legit callers, immune to injection.
    // NaN/invalid limits are ignored (same as "no limit" before).
    const parsedLimit = filters?.limit ? Number(filters.limit) : undefined;
    const limitValue =
      parsedLimit !== undefined && Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(1000, Math.floor(parsedLimit)))
        : undefined;
    const limitClause = limitValue !== undefined ? "LIMIT ?" : "";
    if (limitValue !== undefined) values.push(limitValue);

    const rows = db.prepare(`
      SELECT p.*, s.full_name as student_name, s.student_code, u.name as received_by_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN users u ON p.received_by = u.id
      ${where}
      ORDER BY p.payment_date DESC, p.created_at DESC
      ${limitClause}
    `).all(...values) as any[];

    return rows.map((r) => this.mapRow(r));
  },

  create(payment: {
    id: string;
    student_id: string;
    fee_id?: string | null;
    amount: number;
    payment_method: string;
    payment_date: string;
    notes?: string | null;
    received_by?: string | null;
    idempotency_key?: string | null;
    sync_id?: string | null;
    created_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO payments (id, student_id, fee_id, amount, payment_method, payment_date, notes, received_by, idempotency_key, sync_id, created_at)
      VALUES (@id, @student_id, @fee_id, @amount, @payment_method, @payment_date, @notes, @received_by, @idempotency_key, @sync_id, @created_at)
    `).run({
      id: payment.id,
      student_id: payment.student_id,
      fee_id: payment.fee_id || null,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      notes: payment.notes || null,
      received_by: payment.received_by || null,
      idempotency_key: payment.idempotency_key || null,
      sync_id: payment.sync_id || null,
      created_at: payment.created_at,
    });
  },

  getTotalRevenue(startDate?: string, endDate?: string): number {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (startDate) {
      conditions.push("payment_date >= ?");
      values.push(startDate);
    }
    if (endDate) {
      conditions.push("payment_date <= ?");
      values.push(endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments ${where}`).get(...values) as { total: number };
    return row?.total || 0;
  },

  update(id: string, updates: Partial<{ amount: number; payment_method: string; payment_date: string; notes: string | null }>): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };
    if (updates.amount !== undefined) { sets.push("amount = @amount"); params.amount = updates.amount; }
    if (updates.payment_method !== undefined) { sets.push("payment_method = @payment_method"); params.payment_method = updates.payment_method; }
    if (updates.payment_date !== undefined) { sets.push("payment_date = @payment_date"); params.payment_date = updates.payment_date; }
    if (updates.notes !== undefined) { sets.push("notes = @notes"); params.notes = updates.notes; }
    if (sets.length > 0) {
      db.prepare(`UPDATE payments SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  delete(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM payments WHERE id = ?").run(id);
  },

  mapRow(row: any): Payment {
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      studentCode: row.student_code,
      feeId: row.fee_id || undefined,
      amount: Number(row.amount),
      paymentMethod: row.payment_method,
      paymentDate: row.payment_date,
      paidAt: row.payment_date,
      notes: row.notes || undefined,
      receivedBy: row.received_by || undefined,
      receivedByName: row.received_by_name || undefined,
      idempotencyKey: row.idempotency_key || undefined,
      createdAt: row.created_at,
    };
  },
};
