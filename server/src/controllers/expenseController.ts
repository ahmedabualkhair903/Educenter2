import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { expenseService } from "../services/expenseService.js";
import { sendSuccess } from "../utils/response.js";

export const expenseController = {
  list(req: AuthRequest, res: Response) {
    const filters = {
      category: req.query.category as string | undefined,
      startDate: (req.query.startDate || req.query.start_date) as string | undefined,
      endDate: (req.query.endDate || req.query.end_date) as string | undefined,
    };
    const expenses = expenseService.list(filters);
    return sendSuccess(res, expenses);
  },

  getById(req: AuthRequest, res: Response) {
    const expense = expenseService.getById(req.params.id);
    return sendSuccess(res, expense);
  },

  create(req: AuthRequest, res: Response) {
    const expense = expenseService.create(req.body, req.user?.id, req.ip);
    return sendSuccess(res, expense, "تم تسجيل المصروف بنجاح", 201);
  },

  delete(req: AuthRequest, res: Response) {
    expenseService.delete(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم حذف المصروف بنجاح");
  },
};
