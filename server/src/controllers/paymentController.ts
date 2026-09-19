import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { paymentRepository } from "../repositories/paymentRepository.js";
import { feePaymentService } from "../services/feePaymentService.js";
import { sendSuccess } from "../utils/response.js";

export const paymentController = {
  list(req: AuthRequest, res: Response) {
    const filters = {
      studentId: (req.query.studentId || req.query.student_id) as string | undefined,
      feeId: (req.query.feeId || req.query.fee_id) as string | undefined,
      paymentMethod: (req.query.paymentMethod || req.query.payment_method) as string | undefined,
      startDate: (req.query.startDate || req.query.start_date) as string | undefined,
      endDate: (req.query.endDate || req.query.end_date) as string | undefined,
      receivedBy: (req.query.receivedBy || req.query.received_by) as string | undefined,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string, 10) : undefined,
    };
    const payments = feePaymentService.listPayments(filters);
    return sendSuccess(res, payments);
  },

  create(req: AuthRequest, res: Response) {
    const idempotencyKey = (req.headers["x-idempotency-key"] as string) || req.body.idempotencyKey;
    const existing = idempotencyKey ? paymentRepository.findByIdempotencyKey(idempotencyKey) : undefined;
    
    const payment = feePaymentService.recordPayment(
      {
        ...req.body,
        idempotencyKey,
      },
      req.user?.id,
      req.ip
    );

    const statusCode = existing ? 200 : 201;
    return sendSuccess(res, payment, "تم تسجيل الدفعة المالية بنجاح", statusCode);
  },

  update(req: AuthRequest, res: Response) {
    const updated = feePaymentService.updatePayment(req.params.id, req.body, req.user?.id, req.ip);
    return sendSuccess(res, updated, "تم تحديث الدفعة بنجاح");
  },

  delete(req: AuthRequest, res: Response) {
    feePaymentService.deletePayment(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم حذف الدفعة بنجاح");
  },
};
