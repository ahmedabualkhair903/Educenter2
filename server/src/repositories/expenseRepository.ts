import { getDatabase } from "../database/db.js";
import type { Expense } from "../models/index.js";

export const expenseRepository = {
  findById(id: string): Expense | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT e.*, u.name as created_by_name
      FROM expenses e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ? AND (e.is_deleted IS NULL OR e.is_deleted = 0)
    `).get(id) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  },

  list(filters?: { category?: string; startDate?: string; endDate?: string }): Expense[] {
    const db = getDatabase();
    const conditions: string[] = ["(e.is_deleted IS NULL OR e.is_deleted = 0)"];
    const values: any[] = [];

    if (filters?.category) {
      conditions.push("e.category = ?");
      values.push(filters.category);
    }
    if (filters?.startDate) {
      conditions.push("e.expense_date >= ?");
      values.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push("e.expense_date <= ?");
      values.push(filters.endDate);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const rows = db.prepare(`
      SELECT e.*, u.name as created_by_name
      FROM expenses e
      LEFT JOIN users u ON e.created_by = u.id
      ${where}
      ORDER BY e.expense_date DESC, e.created_at DESC
    `).all(...values) as any[];

    return rows.map((r) => this.mapRow(r));
  },

  create(expense: {
    id: string;
    category: string;
    amount: number;
    description?: string | null;
    expense_date: string;
    created_by?: string | null;
    sync_id?: string | null;
    created_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO expenses (id, category, amount, description, expense_date, created_by, sync_id, created_at)
      VALUES (@id, @category, @amount, @description, @expense_date, @created_by, @sync_id, @created_at)
    `).run({
      id: expense.id,
      category: expense.category,
      amount: expense.amount,
      description: expense.description || null,
      expense_date: expense.expense_date,
      created_by: expense.created_by || null,
      sync_id: expense.sync_id || null,
      created_at: expense.created_at,
    });
  },

  getTotalExpenses(startDate?: string, endDate?: string): number {
    const db = getDatabase();
    const conditions: string[] = ["(is_deleted IS NULL OR is_deleted = 0)"];
    const values: any[] = [];

    if (startDate) {
      conditions.push("expense_date >= ?");
      values.push(startDate);
    }
    if (endDate) {
      conditions.push("expense_date <= ?");
      values.push(endDate);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${where}`).get(...values) as { total: number };
    return row?.total || 0;
  },

  delete(id: string, deletedBy?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare("UPDATE expenses SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?").run(now, deletedBy || null, id);
  },

  mapRow(row: any): Expense {
    return {
      id: row.id,
      category: row.category,
      amount: Number(row.amount),
      description: row.description || undefined,
      expenseDate: row.expense_date,
      createdBy: row.created_by || undefined,
      createdByName: row.created_by_name || undefined,
      createdAt: row.created_at,
    };
  },
};
