import { getDatabase } from "../database/db.js";
import type { Fee } from "../models/index.js";

export const feeRepository = {
  findById(id: string): Fee | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT f.*, s.full_name as student_name, s.student_code,
        COALESCE((SELECT SUM(amount) FROM payments WHERE fee_id = f.id), 0) as paid_amount
      FROM fees f
      JOIN students s ON f.student_id = s.id
      WHERE f.id = ?
    `).get(id) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  },

  listByStudent(studentId: string): Fee[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT f.*, s.full_name as student_name, s.student_code,
        COALESCE((SELECT SUM(amount) FROM payments WHERE fee_id = f.id), 0) as paid_amount
      FROM fees f
      JOIN students s ON f.student_id = s.id
      WHERE f.student_id = ?
      ORDER BY f.due_date ASC
    `).all(studentId) as any[];
    return rows.map((r) => this.mapRow(r));
  },

  listAll(filters?: { studentId?: string; groupId?: string; status?: string; period?: string }): Fee[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters?.studentId) {
      conditions.push("f.student_id = ?");
      values.push(filters.studentId);
    }
    if (filters?.groupId) {
      conditions.push("f.group_id = ?");
      values.push(filters.groupId);
    }
    if (filters?.status) {
      conditions.push("f.status = ?");
      values.push(filters.status);
    }
    if (filters?.period) {
      conditions.push("f.period = ?");
      values.push(filters.period);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT f.*, s.full_name as student_name, s.student_code,
        COALESCE((SELECT SUM(amount) FROM payments WHERE fee_id = f.id), 0) as paid_amount
      FROM fees f
      JOIN students s ON f.student_id = s.id
      ${where}
      ORDER BY f.created_at DESC
    `).all(...values) as any[];

    return rows.map((r) => this.mapRow(r));
  },

  create(fee: {
    id: string;
    student_id: string;
    group_id?: string | null;
    amount_required: number;
    discount: number;
    amount_after_discount: number;
    period: string;
    due_date: string;
    status: string;
    sync_id?: string | null;
    created_at: string;
    updated_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO fees (id, student_id, group_id, amount_required, discount, amount_after_discount, period, due_date, status, sync_id, created_at, updated_at)
      VALUES (@id, @student_id, @group_id, @amount_required, @discount, @amount_after_discount, @period, @due_date, @status, @sync_id, @created_at, @updated_at)
    `).run({
      id: fee.id,
      student_id: fee.student_id,
      group_id: fee.group_id || null,
      amount_required: fee.amount_required,
      discount: fee.discount || 0,
      amount_after_discount: fee.amount_after_discount,
      period: fee.period,
      due_date: fee.due_date,
      status: fee.status || "unpaid",
      sync_id: fee.sync_id || null,
      created_at: fee.created_at,
      updated_at: fee.updated_at,
    });
  },

  updateStatus(feeId: string, status: "unpaid" | "partial" | "paid"): void {
    const db = getDatabase();
    db.prepare("UPDATE fees SET status = ?, updated_at = ? WHERE id = ?").run(
      status,
      new Date().toISOString(),
      feeId
    );
  },

  mapRow(row: any): Fee {
    const paidAmount = Number(row.paid_amount || 0);
    const amountAfterDiscount = Number(row.amount_after_discount || 0);
    const remainingAmount = Math.max(0, amountAfterDiscount - paidAmount);

    return {
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      studentCode: row.student_code,
      groupId: row.group_id || undefined,
      amountRequired: Number(row.amount_required),
      discount: Number(row.discount),
      amountAfterDiscount,
      paidAmount,
      remainingAmount,
      period: row.period,
      dueDate: row.due_date,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
