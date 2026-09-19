export type MessageType =
  | "individual"
  | "group"
  | "notification"
  | "reminder"
  | "examResult"
  | "attendance"
  | "checkOut"
  | "absence";

export type MessageStatus =
  | "draft"
  | "scheduled"
  | "pending"
  | "sent"
  | "failed";

export type MessageAttachment = {
  /** صيغة dataURL: data:<mime>;base64,... */
  data?: string;
  name: string;
  mime: string;
  size: number;
};

export const MESSAGE_ATTACHMENT_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

export type WhatsAppMessage = {
  id: string;

  /**
   * Student ID when the message targets
   * an individual student.
   *
   * For group/bulk messages this can contain
   * a group or audience identifier.
   */
  studentId: string;

  /**
   * Guardian phone number used by the
   * future WhatsApp integration.
   */
  guardianPhone: string;
  recipientPhone?: string;
  phone?: string;

  type: MessageType;

  status: MessageStatus;

  content?: string;
  message?: string;
  body?: string;

  /**
   * Display title used by the messages screen.
   */
  title?: string;

  /**
   * Display recipient label used by the messages screen.
   */
  recipient?: string;

  /**
   * Number of recipients for group/bulk messages.
   */
  recipientsCount?: number;

  /**
   * Scheduling labels used by the messages screen.
   */
  scheduledDate?: string;

  scheduledTime?: string;
  scheduledAt?: string;

  createdAt: string;

  sentAt?: string;

  error?: string;

  /** مرفق الرسالة (صورة/PDF) — البيانات الكاملة عبر getById فقط */
  hasAttachment?: boolean;
  attachmentName?: string;
  attachmentMime?: string;
  attachmentSize?: number;
  attachmentData?: string;
  attachment?: MessageAttachment | null;

  /** معرّف حساب الإرسال المربوط (null = الحساب الافتراضي) */
  whatsappAccountId?: string;
};