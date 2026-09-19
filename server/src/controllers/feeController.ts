import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { feePaymentService } from "../services/feePaymentService.js";
import { sendSuccess } from "../utils/response.js";

export const feeController = {
  list(req: AuthRequest, res: Response) {
    const filters = {
      studentId: (req.query.studentId || req.query.student_id) as string | undefined,
      groupId: (req.query.groupId || req.query.group_id) as string | undefined,
      status: req.query.status as string | undefined,
      period: req.query.period as string | undefined,
    };
    const fees = feePaymentService.listFees(filters);
    return sendSuccess(res, fees);
  },

  create(req: AuthRequest, res: Response) {
    const fee = feePaymentService.createFee(req.body, req.user?.id, req.ip);
    return sendSuccess(res, fee, "تم إضافة الرسوم بنجاح", 201);
  },

  getStudentFinance(req: AuthRequest, res: Response) {
    const summary = feePaymentService.getStudentFinancialSummary(req.params.studentId);
    return sendSuccess(res, summary);
  },
};
