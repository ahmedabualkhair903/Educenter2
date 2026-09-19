import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { defaultWhatsAppProvider } from "../providers/whatsapp/index.js";
import { whatsappAccountRepository } from "../repositories/whatsappAccountRepository.js";
import { notificationService } from "../services/notificationService.js";
import { sendSuccess } from "../utils/response.js";

export const notificationController = {
  list(req: AuthRequest, res: Response) {
    const filters = {
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      studentId: (req.query.studentId || req.query.student_id) as string | undefined,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string, 10) : undefined,
    };
    const list = notificationService.list(filters);
    return sendSuccess(res, list);
  },

  getById(req: AuthRequest, res: Response) {
    const item = notificationService.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "الرسالة غير موجودة" });
    }
    return sendSuccess(res, item);
  },

  create(req: AuthRequest, res: Response) {
    const body = req.body ?? {};

    // بث جديد: طالب واحد أو عدة مجموعات
    if (body.recipientType === "student" || body.recipientType === "groups") {
      const groupIds = body.groupIds || body.groupIDs;
      const result = notificationService.createBroadcast({
        title: body.title,
        message: body.message || body.body || body.content,
        body: body.body,
        type: body.type,
        status: body.status,
        recipientType: body.recipientType,
        studentId: body.studentId,
        groupIds,
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime,
        scheduledAt: body.scheduledAt,
        attachment: body.attachment ?? null,
        accountId: body.accountId || body.account_id || null,
      });
      const skippedNote = result.skipped.length > 0 ? ` (تم تخطي ${result.skipped.length})` : "";
      return sendSuccess(
        res,
        result,
        `تمت جدولة ${result.queuedCount} رسالة بنجاح${skippedNote}`,
        201
      );
    }

    // رسالة مفردة (توافق خلفي مع الشكل القديم)
    const created = notificationService.createCustom(req.body);
    return sendSuccess(res, created, "تم إنشاء وجدولة الرسالة بنجاح", 201);
  },

  update(req: AuthRequest, res: Response) {
    const updated = notificationService.update(req.params.id, req.body);
    return sendSuccess(res, updated, "تم تحديث الرسالة بنجاح");
  },

  delete(req: AuthRequest, res: Response) {
    notificationService.delete(req.params.id);
    return sendSuccess(res, null, "تم حذف الرسالة بنجاح");
  },

  retry(req: AuthRequest, res: Response) {
    const count = notificationService.retryFailed();
    return sendSuccess(res, { retriedCount: count }, `تمت إعادة جدولة ${count} رسالة فاشلة`);
  },

  sendFeeReminders(req: AuthRequest, res: Response) {
    const groupId = req.body?.groupId as string | undefined;
    const result = notificationService.sendFeeRemindersForUnpaidStudents(groupId);
    return sendSuccess(res, result, `تمت جدولة ${result.queuedCount} رسالة تذكير للمستحقات غير المسددة`);
  },

  async testSend(req: AuthRequest, res: Response) {
    const { phone, message } = req.body;
    const result = await defaultWhatsAppProvider.sendMessage(phone, message);
    return sendSuccess(res, result, "تم إرسال رسالة الاختبار بنجاح");
  },

  async getProviderStatus(req: AuthRequest, res: Response) {
    // ديناميكي: حساب افتراضي من قاعدة البيانات أولاً، ثم إعدادات .env
    const fallback = whatsappAccountRepository.findDefault();
    if (fallback) {
      return sendSuccess(res, {
        provider: `whatsapp-account:${fallback.providerName}`,
        ready: true,
        details: `الحساب الافتراضي ${fallback.phoneNumber} (${fallback.providerName})`,
        source: "database",
        accountId: fallback.id,
        phoneNumber: fallback.phoneNumber,
      });
    }
    const status = await defaultWhatsAppProvider.getStatus();
    return sendSuccess(res, { provider: defaultWhatsAppProvider.name, ...status, source: "env" });
  },
};
