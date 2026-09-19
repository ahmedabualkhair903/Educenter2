import crypto from "node:crypto";
import { logAudit } from "../middleware/audit.js";
import type { Expense } from "../models/index.js";
import { expenseRepository } from "../repositories/expenseRepository.js";
import { AppError } from "../utils/response.js";

export const expenseService = {
  list(filters?: { category?: string; startDate?: string; endDate?: string }): Expense[] {
    return expenseRepository.list(filters);
  },

  getById(id: string): Expense {
    const expense = expenseRepository.findById(id);
    if (!expense) {
      throw new AppError("المصروف غير موجود", 404, "EXPENSE_NOT_FOUND");
    }
    return expense;
  },

  create(data: {
    category: "Rent" | "Electricity" | "Salaries" | "Printing" | "Maintenance" | "Internet" | "Supplies" | "Other";
    amount: number;
    description?: string | null;
    expenseDate: string;
  }, creatorId?: string, ip?: string): Expense {
    if (data.amount <= 0) {
      throw new AppError("مبلغ المصروف يجب أن يكون أكبر من صفر", 400, "INVALID_AMOUNT");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    expenseRepository.create({
      id,
      category: data.category,
      amount: data.amount,
      description: data.description || null,
      expense_date: data.expenseDate,
      created_by: creatorId || null,
      sync_id: crypto.randomUUID(),
      created_at: now,
    });

    logAudit({
      userId: creatorId,
      action: "CREATE_EXPENSE",
      entityType: "EXPENSE",
      entityId: id,
      newData: data,
      ip,
    });

    return expenseRepository.findById(id)!;
  },

  delete(id: string, deleterId?: string, ip?: string): boolean {
    const expense = this.getById(id);
    expenseRepository.delete(id, deleterId);

    logAudit({
      userId: deleterId,
      action: "DELETE_EXPENSE",
      entityType: "EXPENSE",
      entityId: id,
      oldData: expense,
      ip,
    });

    return true;
  },
};
