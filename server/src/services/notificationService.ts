import crypto from "node:crypto";
import { getDatabase } from "../database/db.js";
import type { Notification } from "../models/index.js";
import { notificationRepository } from "../repositories/notificationRepository.js";
import { settingsRepository } from "../repositories/settingsRepository.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/response.js";

import { feeRepository } from "../repositories/feeRepository.js";
import { groupRepository } from "../repositories/groupRepository.js";
import { studentRepository } from "../repositories/studentRepository.js";
import { whatsappAccountRepository } from "../repositories/whatsappAccountRepository.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** تطبيع نوع رسالة الواجهة إلى مفردات قاعدة البيانات */
function normalizeNotifType(type?: string): string {
  if (!type || typeof type !== "string") return "general";
  const t = type.trim();
  if (t === "examResult") return "exam_result";
  if (t === "checkOut") return "check_out";
  const allowed = new Set([
    "check_in", "check_out", "exam_result", "fee_reminder", "payment_receipt",
    "absence", "general", "individual", "group", "notification", "reminder", "attendance",
  ]);
  return allowed.has(t) ? t : "general";
}

/** تطبيع الحالة إلى مفردات قاعدة البيانات */
function normalizeNotifStatus(status?: string): string {
  const allowed = new Set(["pending", "processing", "sent", "failed", "draft", "scheduled"]);
  if (typeof status === "string" && allowed.has(status.trim())) return status.trim();
  return "pending";
}

/** camelCase للعرض في الواجهة */
function denormalizeNotifType(type: string): string {
  if (type === "exam_result") return "examResult";
  if (type === "check_out") return "checkOut";
  return type;
}

function toISODateTime(date?: string, time?: string): string | undefined {
  if (!date) return undefined;
  const t = time && /^\d{1,2}:\d{2}/.test(time) ? time.slice(0, 5) : "00:00";
  const d = new Date(`${date}T${t}:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function splitDateTime(iso?: string | null): { date?: string; time?: string } {
  if (!iso) return {};
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return {};
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export type BroadcastRecipientType = "student" | "groups";

export type NotificationAttachment = {
  data: string;
  name: string;
  mime: string;
  size: number;
};

/** تنظيف المرفق: إرجاع null عند الغياب، مع تقليم الاسم */
function normalizeAttachment(
  attachment?: NotificationAttachment | null
): NotificationAttachment | null {
  if (!attachment || typeof attachment !== "object") return null;
  if (typeof attachment.data !== "string" || !attachment.data) return null;
  return {
    data: attachment.data,
    name: typeof attachment.name === "string" ? attachment.name.trim().slice(0, 150) : "مرفق",
    mime: attachment.mime,
    size: attachment.size,
  };
}

/**
 * تحقق من حساب الإرسال المحدد للرسالة، أو ربط الحساب الافتراضي
 * تلقائياً عند غيابه حتى لا يُخزن whatsapp_account_id كـ null.
 * - معرّف صريح غير موجود/غير نشط → خطأ واضح فوري.
 * - غياب المعرف → معرّف الحساب الافتراضي النشط، أو null إن لم يوجد
 *   (عندها يتولى الـ worker البدائل: الافتراضي ثم .env ثم المحاكاة).
 */
function resolveAccountId(accountId?: string | null): string | null {
  const clean = typeof accountId === "string" ? accountId.trim() : "";
  if (clean) {
    const account = whatsappAccountRepository.findById(clean);
    if (!account) {
      throw new AppError("حساب الواتساب المحدد غير موجود", 404, "WHATSAPP_ACCOUNT_NOT_FOUND");
    }
    if (account.status !== "active") {
      throw new AppError("حساب الواتساب المحدد غير نشط", 400, "ACCOUNT_INACTIVE");
    }
    return account.id;
  }
  const fallback = whatsappAccountRepository.findDefault();
  return fallback ? fallback.id : null;
}

export const notificationService = {
  queueMessage(data: {
    studentId?: string;
    recipientPhone: string;
    type: "check_in" | "check_out" | "exam_result" | "fee_reminder" | "payment_receipt" | "absence" | "general";
    message: string;
    scheduledAt?: string;
  }): Notification | null {
    const settings = settingsRepository.getAll();
    if (!settings.notifications.whatsappEnabled) {
      logger.info(`WhatsApp notification skipped (globally disabled): ${data.type}`);
      return null;
    }

    if (data.type === "check_in" && !settings.notifications.attendanceMessagesEnabled) return null;
    if (data.type === "check_out" && !settings.notifications.checkOutMessagesEnabled) return null;
    if (data.type === "exam_result" && !settings.notifications.resultMessagesEnabled) return null;
    if (data.type === "absence" && !settings.notifications.absenceMessagesEnabled) return null;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    notificationRepository.create({
      id,
      student_id: data.studentId || null,
      recipient_phone: data.recipientPhone,
      type: data.type,
      message: data.message,
      status: "pending",
      scheduled_at: data.scheduledAt || now,
      sync_id: crypto.randomUUID(),
      created_at: now,
    });

    return notificationRepository.findById(id)!;
  },

  onStudentCheckIn(studentName: string, phone: string, time: string, studentId?: string) {
    const message = `تم تسجيل حضور الطالب ${studentName} الساعة ${time}.`;
    return this.queueMessage({
      studentId,
      recipientPhone: phone,
      type: "check_in",
      message,
    });
  },

  onStudentCheckOut(studentName: string, phone: string, time: string, studentId?: string) {
    const message = `تم تسجيل انصراف الطالب ${studentName} الساعة ${time}.`;
    return this.queueMessage({
      studentId,
      recipientPhone: phone,
      type: "check_out",
      message,
    });
  },

  onExamResult(studentName: string, phone: string, examName: string, score: number, maxScore: number, studentId?: string) {
    const message = `تم رصد نتيجة اختبار (${examName}) للطالب ${studentName}: الدرجة ${score} من ${maxScore}.`;
    return this.queueMessage({
      studentId,
      recipientPhone: phone,
      type: "exam_result",
      message,
    });
  },

  onPaymentReceipt(studentName: string, phone: string, amount: number, remaining: number, studentId?: string) {
    const message = `تم استلام دفعة مالية بمبلغ ${amount} ج.م بنجاح للطالب ${studentName}. المبلغ المتبقي: ${remaining} ج.م.`;
    return this.queueMessage({
      studentId,
      recipientPhone: phone,
      type: "payment_receipt",
      message,
    });
  },

  onFeeReminder(studentName: string, phone: string, amountDue: number, period: string, dueDate: string, studentId?: string) {
    const message = `تذكير بمستحقات السنتر: نرجو من ولي أمر الطالب ${studentName} سداد مبلغ ${amountDue} ج.م عن (${period}) المستحق في ${dueDate}. شاكرين تعاونكم.`;
    return this.queueMessage({
      studentId,
      recipientPhone: phone,
      type: "fee_reminder",
      message,
    });
  },

  sendFeeRemindersForUnpaidStudents(groupId?: string): { queuedCount: number; skippedCount: number } {
    const unpaidFees = feeRepository.listAll({
      groupId,
      status: "unpaid",
    });

    let queuedCount = 0;
    let skippedCount = 0;

    for (const fee of unpaidFees) {
      const student = studentRepository.findById(fee.studentId);
      const recipientPhone = student?.guardianPhone || student?.phone;
      if (student && recipientPhone && fee.remainingAmount && fee.remainingAmount > 0) {
        const result = this.onFeeReminder(
          student.name,
          recipientPhone,
          fee.remainingAmount,
          fee.period,
          fee.dueDate,
          student.id
        );
        if (result) {
          queuedCount++;
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    return { queuedCount, skippedCount };
  },

  onAbsence(studentName: string, phone: string, groupName: string, date: string, studentId?: string) {
    const message = `نحيطكم علماً بغياب الطالب ${studentName} عن حصة (${groupName}) بتاريخ ${date}.`;
    return this.queueMessage({
      studentId,
      recipientPhone: phone,
      type: "absence",
      message,
    });
  },

  list(filters?: { status?: string; type?: string; studentId?: string; limit?: number }): any[] {
    const rows = notificationRepository.list(filters);
    // إرجاع صفوف camelCase جاهزة لشاشة الرسائل مع اسم الطالب والتاريخ المقسم
    // (بيانات المرفق الكاملة تُجلب عبر getById فقط لتخفيف القائمة)
    return rows.map((row: any) => {
      const { date, time } = splitDateTime(row.scheduled_at);
      return {
        id: row.id,
        studentId: row.student_id || "",
        studentName: row.student_name || undefined,
        recipientPhone: row.recipient_phone,
        guardianPhone: row.recipient_phone,
        type: denormalizeNotifType(row.type),
        title: row.title || undefined,
        content: row.message,
        message: row.message,
        status: row.status,
        scheduledAt: row.scheduled_at,
        scheduledDate: date,
        scheduledTime: time,
        sentAt: row.sent_at || undefined,
        error: row.error || undefined,
        recipientsCount: 1,
        hasAttachment: Boolean(row.attachment_data),
        attachmentName: row.attachment_name || undefined,
        attachmentMime: row.attachment_mime || undefined,
        attachmentSize: row.attachment_size ?? undefined,
        whatsappAccountId: row.whatsapp_account_id || undefined,
        createdAt: row.created_at,
      };
    });
  },

  getById(id: string): any {
    const row: any = notificationRepository.findById(id);
    if (!row) return undefined;
    const { date, time } = splitDateTime(row.scheduled_at);
    return {
      id: row.id,
      studentId: row.student_id || "",
      recipientPhone: row.recipient_phone,
      guardianPhone: row.recipient_phone,
      type: denormalizeNotifType(row.type),
      title: row.title || undefined,
      content: row.message,
      message: row.message,
      status: row.status,
      scheduledAt: row.scheduled_at,
      scheduledDate: date,
      scheduledTime: time,
      sentAt: row.sent_at || undefined,
      error: row.error || undefined,
      recipientsCount: 1,
      hasAttachment: Boolean(row.attachment_data),
      attachmentName: row.attachment_name || undefined,
      attachmentMime: row.attachment_mime || undefined,
      attachmentSize: row.attachment_size ?? undefined,
      attachmentData: row.attachment_data || undefined,
      whatsappAccountId: row.whatsapp_account_id || undefined,
      createdAt: row.created_at,
    };
  },

  createCustom(data: { title?: string; phone?: string; recipientPhone?: string; body?: string; content?: string; message?: string; studentId?: string; type?: string; status?: string; scheduledDate?: string; scheduledTime?: string; scheduledAt?: string; attachment?: NotificationAttachment | null; accountId?: string | null }): any {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const phone = (data.recipientPhone || data.phone || "").trim();
    const message = (data.message || data.body || data.content || "").trim();
    if (!message) {
      throw new AppError("محتوى الرسالة مطلوب", 400, "MESSAGE_REQUIRED");
    }
    if (!phone) {
      throw new AppError("رقم هاتف المستلم مطلوب", 400, "PHONE_REQUIRED");
    }
    const status = normalizeNotifStatus(data.status);
    const scheduledAt =
      data.scheduledAt ||
      toISODateTime(data.scheduledDate, data.scheduledTime) ||
      now;
    const attachment = normalizeAttachment(data.attachment);
    const accountId = resolveAccountId(data.accountId);

    notificationRepository.create({
      id,
      student_id: data.studentId || null,
      recipient_phone: phone,
      title: data.title?.trim() || null,
      type: normalizeNotifType(data.type),
      message: message,
      status,
      scheduled_at: scheduledAt,
      attachment_data: attachment?.data || null,
      attachment_name: attachment?.name || null,
      attachment_mime: attachment?.mime || null,
      attachment_size: attachment?.size ?? null,
      whatsapp_account_id: accountId,
      sync_id: crypto.randomUUID(),
      created_at: now,
    });

    return notificationRepository.findById(id);
  },

  /**
   * إرسال جماعي (Multicast): طالب واحد أو عدة مجموعات.
   * ينشئ صفاً واحداً لكل مستلم لديه هاتف (ولي الأمر أولاً)
   * ويعيد ملخصاً بالمنشأ والمتخطى — دون أي استثناء صامت.
   */
  createBroadcast(data: {
    title?: string;
    message?: string;
    body?: string;
    content?: string;
    type?: string;
    status?: string;
    recipientType: BroadcastRecipientType;
    studentId?: string;
    groupIds?: string[];
    scheduledDate?: string;
    scheduledTime?: string;
    scheduledAt?: string;
    attachment?: NotificationAttachment | null;
    accountId?: string | null;
  }): { notifications: any[]; queuedCount: number; skipped: { id: string; reason: string }[] } {
    const message = (data.message || data.body || data.content || "").trim();
    if (!message) {
      throw new AppError("محتوى الرسالة مطلوب", 400, "MESSAGE_REQUIRED");
    }

    const now = new Date().toISOString();
    const status = normalizeNotifStatus(data.status);
    const scheduledAt =
      data.scheduledAt ||
      toISODateTime(data.scheduledDate, data.scheduledTime) ||
      now;
    const type = normalizeNotifType(data.type);
    const title = data.title?.trim() || null;
    const attachment = normalizeAttachment(data.attachment);
    const accountId = resolveAccountId(data.accountId);

    // ─── جمع المستهدفين ───
    const targets = new Map<string, { studentId: string; phone: string; name: string }>();
    const skipped: { id: string; reason: string }[] = [];

    if (data.recipientType === "student") {
      const studentId = data.studentId?.trim();
      if (!studentId) {
        throw new AppError("معرّف الطالب مطلوب عند اختيار طالب واحد", 400, "STUDENT_REQUIRED");
      }
      const student = studentRepository.findById(studentId);
      if (!student) {
        throw new AppError("الطالب المحدد غير موجود", 404, "STUDENT_NOT_FOUND");
      }
      const phone = (student.guardianPhone || student.phone || "").trim();
      if (!phone) {
        throw new AppError("الطالب المحدد ليس لديه رقم هاتف", 400, "NO_PHONE");
      }
      targets.set(student.id, { studentId: student.id, phone, name: student.name });
    } else if (data.recipientType === "groups") {
      const groupIds = [...new Set((data.groupIds || []).map((g) => g?.trim()).filter(Boolean))];
      if (groupIds.length === 0) {
        throw new AppError("اختر مجموعة واحدة على الأقل", 400, "GROUPS_REQUIRED");
      }
      for (const groupId of groupIds) {
        const group = groupRepository.findById(groupId);
        if (!group) {
          throw new AppError("إحدى المجموعات المحددة غير موجودة", 404, "GROUP_NOT_FOUND");
        }
        const students = groupRepository.listStudentsInGroup(groupId);
        if (students.length === 0) {
          skipped.push({ id: groupId, reason: `المجموعة "${group.name}" لا تحتوي على طلاب` });
          continue;
        }
        for (const student of students) {
          if (targets.has(student.id)) continue;
          const phone = (student.guardianPhone || student.phone || "").trim();
          if (!phone) {
            skipped.push({ id: student.id, reason: `الطالب "${student.name}" ليس لديه رقم هاتف` });
            continue;
          }
          targets.set(student.id, { studentId: student.id, phone, name: student.name });
        }
      }
      if (targets.size === 0) {
        throw new AppError("لا يوجد مستلمون صالحون في المجموعات المحددة", 400, "NO_RECIPIENTS");
      }
    } else {
      throw new AppError("نوع المستلم غير صالح", 400, "INVALID_RECIPIENT_TYPE");
    }

    // ─── الإنشاء في معاملة واحدة ───
    const created: any[] = [];
    const db = getDatabase();
    db.transaction(() => {
      for (const target of targets.values()) {
        const id = crypto.randomUUID();
        notificationRepository.create({
          id,
          student_id: target.studentId,
          recipient_phone: target.phone,
          title,
          type,
          message,
          status,
          scheduled_at: scheduledAt,
          attachment_data: attachment?.data || null,
          attachment_name: attachment?.name || null,
          attachment_mime: attachment?.mime || null,
          attachment_size: attachment?.size ?? null,
          whatsapp_account_id: accountId,
          sync_id: crypto.randomUUID(),
          created_at: now,
        });
        created.push(notificationRepository.findById(id));
      }
    })();

    return { notifications: created, queuedCount: created.length, skipped };
  },

  update(id: string, updates: any): any {
    if (!id || (typeof id === "string" && !id.trim())) {
      throw new AppError("معرّف الرسالة مطلوب", 400, "INVALID_NOTIFICATION_ID");
    }
    const existing = notificationRepository.findById(id);
    if (!existing) {
      throw new AppError("الرسالة غير موجودة", 404, "NOTIFICATION_NOT_FOUND");
    }
    const payload: any = {};
    if (updates.title !== undefined) payload.title = updates.title?.trim() || null;
    if (updates.message !== undefined) payload.message = updates.message;
    if (updates.body !== undefined) payload.message = updates.body;
    if (updates.content !== undefined) payload.message = updates.content;
    if (updates.type !== undefined) payload.type = normalizeNotifType(updates.type);
    // رقم الهاتف عمود NOT NULL: نتجاهل القيم الفارغة/null (الـ validator
    // يحوّل "" إلى null) حتى لا نكسر القيد — يُحدَّث فقط برقم حقيقي.
    const phone =
      updates.recipientPhone || updates.phone || updates.guardianPhone;
    if (typeof phone === "string" && phone.trim()) {
      payload.recipient_phone = phone.trim();
    }
    if (updates.status !== undefined) payload.status = normalizeNotifStatus(updates.status);
    // ربط/فك حساب الإرسال: معرّف صالح يُتحقق منه، فارغ/null يفك الربط
    if (updates.accountId !== undefined || updates.account_id !== undefined) {
      const raw = (updates.accountId ?? updates.account_id) as string | null | undefined;
      const clean = typeof raw === "string" ? raw.trim() : "";
      payload.whatsapp_account_id = clean ? resolveAccountId(clean) : null;
    }
    const scheduledAt =
      updates.scheduledAt ||
      toISODateTime(updates.scheduledDate, updates.scheduledTime);
    if (scheduledAt) payload.scheduled_at = scheduledAt;
    // المرفق: كائن كامل للاستبدال، null صريح للمسح، وغياب المفتاح يعني الإبقاء
    if (updates.attachment !== undefined) {
      const attachment = normalizeAttachment(updates.attachment);
      payload.attachment_data = attachment?.data || null;
      payload.attachment_name = attachment?.name || null;
      payload.attachment_mime = attachment?.mime || null;
      payload.attachment_size = attachment?.size ?? null;
    }

    notificationRepository.update(id, payload);
    return notificationRepository.findById(id);
  },

  delete(id: string): boolean {
    notificationRepository.delete(id);
    return true;
  },

  retryFailed(): number {
    return notificationRepository.retryFailed();
  },
};
