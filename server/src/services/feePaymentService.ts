import crypto from "node:crypto";
import { getDatabase } from "../database/db.js";
import { logAudit } from "../middleware/audit.js";
import type { Fee, Payment, StudentFinancialSummary } from "../models/index.js";
import { feeRepository } from "../repositories/feeRepository.js";
import { paymentRepository } from "../repositories/paymentRepository.js";
import { studentRepository } from "../repositories/studentRepository.js";
import { AppError } from "../utils/response.js";
import { notificationService } from "./notificationService.js";

export const feePaymentService = {
  getStudentFinancialSummary(studentId: string): StudentFinancialSummary {
    return studentRepository.getFinancialSummary(studentId);
  },

  listFees(filters?: { studentId?: string; groupId?: string; status?: string; period?: string }): Fee[] {
    return feeRepository.listAll(filters);
  },

  listPayments(filters?: {
    studentId?: string;
    feeId?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    receivedBy?: string;
    limit?: number;
  }): Payment[] {
    return paymentRepository.list(filters);
  },

  createFee(data: {
    studentId: string;
    groupId?: string | null;
    amountRequired: number;
    discount?: number;
    period: string;
    dueDate: string;
  }, creatorId?: string, ip?: string): Fee {
    const student = studentRepository.findById(data.studentId);
    if (!student) {
      throw new AppError("الطالب غير موجود", 404, "STUDENT_NOT_FOUND");
    }

    if (data.amountRequired <= 0) {
      throw new AppError("المبلغ المطلوب يجب أن يكون أكبر من صفر", 400, "INVALID_AMOUNT");
    }

    const discount = Math.max(0, data.discount || 0);
    const amountAfterDiscount = Math.max(0, data.amountRequired - discount);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    feeRepository.create({
      id,
      student_id: data.studentId,
      group_id: data.groupId || null,
      amount_required: data.amountRequired,
      discount,
      amount_after_discount: amountAfterDiscount,
      period: data.period.trim(),
      due_date: data.dueDate,
      status: "unpaid",
      sync_id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });

    logAudit({
      userId: creatorId,
      action: "CREATE_FEE",
      entityType: "FEE",
      entityId: id,
      newData: { studentName: student.name, amountRequired: data.amountRequired, discount, period: data.period },
      ip,
    });

    return feeRepository.findById(id)!;
  },

  recordPayment(data: {
    studentId: string;
    feeId?: string | null;
    amount: number;
    paymentMethod: "cash" | "bank_transfer" | "vodafone_cash" | "instapay" | "other";
    paymentDate?: string;
    notes?: string | null;
    idempotencyKey?: string | null;
  }, receiverId?: string, ip?: string): Payment {
    const student = studentRepository.findById(data.studentId);
    if (!student) {
      throw new AppError("الطالب غير موجود", 404, "STUDENT_NOT_FOUND");
    }

    if (data.amount <= 0) {
      throw new AppError("مبلغ الدفع يجب أن يكون أكبر من صفر", 400, "INVALID_AMOUNT");
    }

    // Idempotency check
    if (data.idempotencyKey) {
      const existingPayment = paymentRepository.findByIdempotencyKey(data.idempotencyKey);
      if (existingPayment) {
        return existingPayment;
      }
    }

    const db = getDatabase();
    const paymentId = crypto.randomUUID();
    const now = new Date().toISOString();
    const paymentDate = data.paymentDate || now.split("T")[0];

    let targetFeeId = data.feeId || null;

    db.transaction(() => {
      // If feeId not explicitly provided, try to find the oldest unpaid fee for this student
      if (!targetFeeId) {
        const unpaidFees = feeRepository.listByStudent(data.studentId).filter((f) => f.status !== "paid");
        if (unpaidFees.length > 0) {
          targetFeeId = unpaidFees[0].id;
        }
      }

      // Check overpayment on the specific fee
      if (targetFeeId) {
        const fee = feeRepository.findById(targetFeeId);
        if (fee && fee.remainingAmount !== undefined && data.amount > fee.remainingAmount) {
          throw new AppError(
            `مبلغ الدفع (${data.amount} ج.م) أكبر من المبلغ المتبقي على الفاتورة (${fee.remainingAmount} ج.م)`,
            400,
            "OVERPAYMENT_NOT_ALLOWED"
          );
        }
      }

      // Insert payment
      paymentRepository.create({
        id: paymentId,
        student_id: data.studentId,
        fee_id: targetFeeId,
        amount: data.amount,
        payment_method: data.paymentMethod,
        payment_date: paymentDate,
        notes: data.notes || null,
        received_by: receiverId || null,
        idempotency_key: data.idempotencyKey || null,
        sync_id: crypto.randomUUID(),
        created_at: now,
      });

      // Update Fee status if attached
      if (targetFeeId) {
        const fee = feeRepository.findById(targetFeeId);
        if (fee) {
          const currentPaid = fee.paidAmount || 0;
          let newStatus: "unpaid" | "partial" | "paid" = "unpaid";
          if (currentPaid >= fee.amountAfterDiscount) {
            newStatus = "paid";
          } else if (currentPaid > 0) {
            newStatus = "partial";
          }
          feeRepository.updateStatus(targetFeeId, newStatus);
        }
      }
    })();

    const payment = paymentRepository.findById(paymentId)!;
    const summary = studentRepository.getFinancialSummary(data.studentId);

    // Trigger WhatsApp notification
    const recipientPhone = student.guardianPhone || student.phone;
    if (recipientPhone) {
      notificationService.onPaymentReceipt(
        student.name,
        recipientPhone,
        data.amount,
        summary.remaining,
        student.id
      );
    }

    logAudit({
      userId: receiverId,
      action: "RECORD_PAYMENT",
      entityType: "PAYMENT",
      entityId: paymentId,
      newData: { studentName: student.name, amount: data.amount, paymentMethod: data.paymentMethod, remaining: summary.remaining },
      ip,
    });

    return payment;
  },

  updatePayment(id: string, updates: any, updaterId?: string, ip?: string): Payment {
    const payment = paymentRepository.findById(id);
    if (!payment) {
      throw new AppError("سجل الدفع غير موجود", 404, "PAYMENT_NOT_FOUND");
    }

    const payload: any = {};
    if (updates.amount !== undefined) {
      if (updates.amount <= 0) throw new AppError("مبلغ الدفع يجب أن يكون أكبر من صفر", 400, "INVALID_AMOUNT");
      payload.amount = Number(updates.amount);
    }
    if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
    if (updates.paymentDate !== undefined) payload.payment_date = updates.paymentDate;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    paymentRepository.update(id, payload);

    if (payment.feeId) {
      const fee = feeRepository.findById(payment.feeId);
      if (fee) {
        const currentPaid = fee.paidAmount || 0;
        let newStatus: "unpaid" | "partial" | "paid" = "unpaid";
        if (currentPaid >= fee.amountAfterDiscount) {
          newStatus = "paid";
        } else if (currentPaid > 0) {
          newStatus = "partial";
        }
        feeRepository.updateStatus(payment.feeId, newStatus);
      }
    }

    logAudit({
      userId: updaterId,
      action: "UPDATE_PAYMENT",
      entityType: "PAYMENT",
      entityId: id,
      oldData: payment,
      newData: updates,
      ip,
    });

    return paymentRepository.findById(id)!;
  },

  deletePayment(id: string, deleterId?: string, ip?: string): boolean {
    const payment = paymentRepository.findById(id);
    if (!payment) {
      throw new AppError("سجل الدفع غير موجود", 404, "PAYMENT_NOT_FOUND");
    }

    paymentRepository.delete(id);

    if (payment.feeId) {
      const fee = feeRepository.findById(payment.feeId);
      if (fee) {
        const currentPaid = fee.paidAmount || 0;
        let newStatus: "unpaid" | "partial" | "paid" = "unpaid";
        if (currentPaid >= fee.amountAfterDiscount) {
          newStatus = "paid";
        } else if (currentPaid > 0) {
          newStatus = "partial";
        }
        feeRepository.updateStatus(payment.feeId, newStatus);
      }
    }

    logAudit({
      userId: deleterId,
      action: "DELETE_PAYMENT",
      entityType: "PAYMENT",
      entityId: id,
      oldData: payment,
      ip,
    });

    return true;
  },
};
