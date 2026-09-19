/**
 * ملف Zod Validators الموحّد للـ Backend
 *
 * يدعم كلاً من camelCase (الواجهة الأمامية) و snake_case (القديم/API الخارجي)
 * عبر z.preprocess أو z.union بحيث لا تحدث أخطاء تحقق بسبب اختلاف التسمية.
 */
import { z } from "zod";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** يحوّل القيم الفارغة ("" / undefined) إلى null بشكل آمن */
const emptyToNull = (v: unknown) =>
  v === "" || v === undefined ? null : v;

/** يحوّل string فارغ إلى undefined بدلاً من null (للحقول الاختيارية الصرفة) */
const emptyToUndefined = (v: unknown) =>
  v === "" ? undefined : v;

// ─── Student Schemas ──────────────────────────────────────────────────────────

export const CreateStudentSchema = z.object({
  // NOTE: student_code / studentId is NEVER accepted from the client.
  // The backend auto-generates a unique STU-YYYY-XXXX code on save.
  // Unknown keys (e.g. legacy `studentId`) are stripped by Zod by default.

  /** الاسم - مطلوب */
  name: z.string({ required_error: "اسم الطالب مطلوب" }).trim().min(2, "الاسم يجب أن يكون حرفين على الأقل"),

  /** الهاتف - اختياري */
  phone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),

  /** اسم ولي الأمر - مطلوب */
  guardianName: z.string({ required_error: "اسم ولي الأمر مطلوب" }).trim().min(2, "اسم ولي الأمر يجب أن يكون حرفين على الأقل"),

  /** هاتف ولي الأمر - مطلوب */
  guardianPhone: z.string({ required_error: "هاتف ولي الأمر مطلوب" }).trim().min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل"),

  /** الجنس */
  gender: z.enum(["male", "female"]).optional().default("male"),

  /** تاريخ الميلاد */
  birthDate: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),

  /** اسم المدرسة */
  schoolName: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),

  /** الصف الدراسي في المدرسة */
  schoolGrade: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),

  /** المرحلة الدراسية في المركز - مطلوبة */
  grade: z.string({ required_error: "المرحلة الدراسية مطلوبة" }).trim().min(1, "المرحلة الدراسية مطلوبة"),

  /** معرّف المجموعة - اختياري، يُحوَّل string فارغ إلى null */
  groupId: z.preprocess(emptyToNull, z.string().min(1, "معرّف المجموعة غير صالح").nullable().optional()),

  /** العنوان */
  address: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),

  /** ملاحظات */
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),

  /** حالة الطالب */
  status: z.enum(["active", "inactive", "suspended"]).optional().default("active"),

  /**
   * البيانات المالية عند التسجيل (اختيارية) — تُنشأ ذرياً مع الطالب:
   * فاتورة بالمطلوب + دفعة أولى مرتبطة بها + حالة محسوبة.
   */
  finance: z.object({
    totalRequired: z.preprocess((v) => {
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        return Number.isNaN(n) ? v : n;
      }
      return v;
    }, z.number({ required_error: "إجمالي المصروفات مطلوب" }).positive("إجمالي المصروفات يجب أن يكون أكبر من صفر").max(10000000)),
    initialPayment: z.preprocess((v) => {
      if (v === "" || v === undefined || v === null) return 0;
      if (typeof v === "string") {
        const n = Number(v);
        return Number.isNaN(n) ? v : n;
      }
      return v;
    }, z.number().min(0, "المبلغ المدفوع لا يمكن أن يكون سالباً").max(10000000).optional().default(0)),
    paymentMethod: z.enum(["cash", "bank_transfer", "vodafone_cash", "instapay", "other"]).optional().default("cash"),
    period: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    dueDate: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  }).optional().refine((f) => !f || (f.initialPayment ?? 0) <= f.totalRequired, {
    message: "المبلغ المدفوع لا يمكن أن يتجاوز إجمالي المصروفات",
    path: ["initialPayment"],
  }),

  /** حقول مخصصة */
  customFields: z.array(
    z.object({
      fieldId: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    })
  ).optional().default([]),
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

// ─── Update Student (جميع الحقول اختيارية) ───────────────────────────────────

export const UpdateStudentSchema = z.object({
  // NOTE: student_code is immutable — updates cannot change it (see service guard).
  name: z.preprocess(emptyToUndefined, z.string().trim().min(2, "الاسم يجب أن يكون حرفين على الأقل").optional()),
  phone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  guardianName: z.preprocess(emptyToUndefined, z.string().trim().min(2).optional()),
  guardianPhone: z.preprocess(emptyToUndefined, z.string().trim().min(8).optional()),
  gender: z.enum(["male", "female"]).optional(),
  birthDate: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  schoolName: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  schoolGrade: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  grade: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  groupId: z.preprocess(emptyToNull, z.string().min(1, "معرّف المجموعة غير صالح").nullable().optional()),
  address: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  customFields: z.array(
    z.object({
      fieldId: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    })
  ).optional(),
});

export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

// ─── Quick Register (تسجيل سريع من شاشة الاستقبال) ───────────────────────────
// يقبل camelCase و snake_case معاً عبر preprocess

export const QuickRegisterSchema = z
  .object({
    // الاسم الكامل: يقبل full_name أو name
    full_name: z.preprocess(emptyToUndefined, z.string().trim().min(2).optional()),
    name: z.preprocess(emptyToUndefined, z.string().trim().min(2).optional()),

    // هاتف الطالب - اختياري
    phone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),

    // هاتف ولي الأمر: guardian_phone أو guardianPhone
    guardian_phone: z.preprocess(emptyToUndefined, z.string().trim().min(8).optional()),
    guardianPhone: z.preprocess(emptyToUndefined, z.string().trim().min(8).optional()),

    // اسم ولي الأمر: guardian_name أو guardianName - اختياري
    guardian_name: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
    guardianName: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),

    // المرحلة الدراسية
    grade: z.string().trim().min(1, "المرحلة الدراسية مطلوبة"),

    // المجموعة: group_id أو groupId - اختياري
    group_id: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
    groupId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  })
  .transform((data) => ({
    full_name: (data.full_name || data.name || "").trim(),
    phone: data.phone || null,
    guardian_phone: (data.guardian_phone || data.guardianPhone || "").trim(),
    guardian_name: data.guardian_name || data.guardianName || null,
    grade: data.grade,
    group_id: data.group_id || data.groupId || null,
  }))
  .refine(
    (data) => data.full_name.length >= 2,
    { message: "الاسم الكامل مطلوب (حرفين على الأقل)", path: ["full_name"] }
  )
  .refine(
    (data) => data.guardian_phone.length >= 8,
    { message: "هاتف ولي الأمر مطلوب", path: ["guardian_phone"] }
  );

export type QuickRegisterInput = z.infer<typeof QuickRegisterSchema>;

// ─── Custom Field Definition ──────────────────────────────────────────────────

export const CustomFieldDefinitionSchema = z.object({
  id: z.string().min(1, "معرّف الحقل مطلوب"),
  label: z.string().trim().min(1, "تسمية الحقل مطلوبة"),
  type: z.enum(["text", "number", "date", "select", "textarea", "boolean"]),
  required: z.boolean().optional().default(false),
  options: z.array(z.string()).optional(),
  active: z.boolean().optional().default(true),
  order: z.number().int().min(0).optional().default(0),
});

export type CustomFieldDefinitionInput = z.infer<typeof CustomFieldDefinitionSchema>;

// ─── Group Schemas ────────────────────────────────────────────────────────────

const GroupScheduleSchema = z.object({
  day: z.string().trim().min(1),
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().optional(),
});

export const CreateGroupSchema = z.object({
  name: z.string({ required_error: "اسم المجموعة مطلوب" }).trim().min(2, "اسم المجموعة يجب أن يكون حرفين على الأقل"),
  teacherId: z.preprocess(emptyToNull, z.string().min(1, "معرّف المدرس غير صالح").nullable().optional()),
  subject: z.string({ required_error: "المادة مطلوبة" }).trim().min(1, "المادة مطلوبة"),
  grade: z.string({ required_error: "المرحلة الدراسية مطلوبة" }).trim().min(1),
  room: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  capacity: z.number().int().min(1).max(500).optional().default(30),
  schedule: z.array(GroupScheduleSchema).optional().default([]),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

export const UpdateGroupSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().min(2).optional()),
  teacherId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  subject: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  grade: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  room: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  capacity: z.number().int().min(1).max(500).optional(),
  schedule: z.array(GroupScheduleSchema).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;

// ─── Enroll Student in Group ──────────────────────────────────────────────────

export const EnrollStudentSchema = z.object({
  studentId: z.string({ required_error: "معرّف الطالب مطلوب" }).min(1, "معرّف الطالب غير صالح"),
});

export type EnrollStudentInput = z.infer<typeof EnrollStudentSchema>;

// ─── Teacher Schemas ──────────────────────────────────────────────────────────

export const CreateTeacherSchema = z.object({
  name: z.string({ required_error: "اسم المدرس مطلوب" }).trim().min(2),
  phone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  subject: z.string({ required_error: "المادة مطلوبة" }).trim().min(1),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;

export const UpdateTeacherSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().min(2).optional()),
  phone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  subject: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  status: z.enum(["active", "inactive"]).optional(),
});

export type UpdateTeacherInput = z.infer<typeof UpdateTeacherSchema>;

// ─── Fee & Payment Schemas ────────────────────────────────────────────────────

export const CreateFeeSchema = z.object({
  studentId: z.string({ required_error: "معرّف الطالب مطلوب" }).min(1),
  groupId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  amountRequired: z.number({ required_error: "المبلغ المطلوب مطلوب" }).positive("المبلغ يجب أن يكون موجباً"),
  discount: z.number().min(0).optional().default(0),
  period: z.string({ required_error: "الفترة مطلوبة" }).trim().min(1),
  dueDate: z.string({ required_error: "تاريخ الاستحقاق مطلوب" }).trim().min(1),
  status: z.enum(["unpaid", "partial", "paid"]).optional().default("unpaid"),
});

export type CreateFeeInput = z.infer<typeof CreateFeeSchema>;

export const CreatePaymentSchema = z.object({
  studentId: z.string({ required_error: "معرّف الطالب مطلوب" }).min(1),
  feeId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  amount: z.number({ required_error: "المبلغ مطلوب" }).positive("المبلغ يجب أن يكون موجباً"),
  paymentMethod: z.enum(["cash", "bank_transfer", "vodafone_cash", "instapay", "other"]).optional().default("cash"),
  paymentDate: z.string().trim().optional(),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

// ─── Attendance Schemas ───────────────────────────────────────────────────────

export const OpenAttendanceSessionSchema = z.object({
  groupId: z.string({ required_error: "معرّف المجموعة مطلوب" }).min(1),
  lessonId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  date: z.string({ required_error: "التاريخ مطلوب" }).trim().min(1),
  startTime: z.string({ required_error: "وقت البداية مطلوب" }).trim().min(1),
  passwordEnabled: z.boolean().optional().default(false),
  password: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
});

export const RecordAttendanceSchema = z.object({
  studentId: z.string({ required_error: "معرّف الطالب مطلوب" }).min(1),
  status: z.enum(["present", "absent", "late", "excused"]).optional().default("present"),
  method: z.enum(["barcode", "qr", "manual"]).optional().default("manual"),
  deviceId: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

export const BarcodeAttendanceSchema = z.object({
  code: z.string({ required_error: "الباركود مطلوب" }).trim().min(1),
  sessionId: z.string({ required_error: "معرّف الجلسة مطلوب" }).min(1),
  deviceId: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

// ─── Exam Schemas ─────────────────────────────────────────────────────────────

export const CreateExamSchema = z.object({
  groupId: z.string({ required_error: "معرّف المجموعة مطلوب" }).min(1),
  name: z.string({ required_error: "اسم الاختبار مطلوب" }).trim().min(1),
  subject: z.string({ required_error: "المادة مطلوبة" }).trim().min(1),
  examDate: z.string({ required_error: "تاريخ الاختبار مطلوب" }).trim().min(1),
  maxScore: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
    z.number({ required_error: "الدرجة الكاملة مطلوبة" }).positive().max(1000)),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
});

// PUT /exams/:id — كل الحقول اختيارية لتفادي 400 Bad Request عند التحديث الجزئي
export const UpdateExamSchema = z.object({
  groupId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  name: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  subject: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  examDate: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  maxScore: z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return undefined;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    }
    return v;
  }, z.number().positive().max(1000).optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: "لا توجد بيانات للتحديث",
});

export const UpsertExamResultSchema = z.object({
  studentId: z.string().min(1).optional(),
  score: z.union([z.number().min(0).max(1000), z.null()]).optional(),
  status: z.enum(["pending", "approved"]).optional().default("pending"),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  results: z.array(z.object({
    studentId: z.string().min(1),
    score: z.union([z.number().min(0).max(1000), z.null()]).optional().default(null),
    status: z.enum(["pending", "approved"]).optional().default("approved"),
    notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  })).optional(),
});

// ─── Expense Schema ───────────────────────────────────────────────────────────

export const CreateExpenseSchema = z.object({
  category: z.enum(["Rent", "Electricity", "Salaries", "Printing", "Maintenance", "Internet", "Supplies", "Other"]),
  amount: z.number({ required_error: "المبلغ مطلوب" }).positive("المبلغ يجب أن يكون موجباً"),
  description: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  expenseDate: z.string({ required_error: "تاريخ المصروف مطلوب" }).trim().min(1),
});

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  username: z.string({ required_error: "اسم المستخدم مطلوب" }).trim().min(3),
  password: z.string({ required_error: "كلمة المرور مطلوبة" }).min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string({ required_error: "كلمة المرور الحالية مطلوبة" }).min(1),
  newPassword: z.string({ required_error: "كلمة المرور الجديدة مطلوبة" }).min(8, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"),
});

export const ResetPasswordSchema = z.object({
  newPassword: z.string({ required_error: "كلمة المرور الجديدة مطلوبة" }).min(6, "كلمة المرور يجب ألا تقل عن 6 أحرف"),
});

export const RegisterSchema = z.object({
  name: z.string({ required_error: "الاسم مطلوب" }).trim().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  email: z.string({ required_error: "البريد الإلكتروني مطلوب" }).email("البريد الإلكتروني غير صالح"),
  phone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  password: z.string({ required_error: "كلمة المرور مطلوبة" }).min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

export const CreateUserSchema = z.object({
  username: z.string({ required_error: "اسم المستخدم مطلوب" }).trim().min(3).max(50),
  name: z.string({ required_error: "الاسم مطلوب" }).trim().min(2),
  email: z.preprocess(emptyToNull, z.string().email("البريد الإلكتروني غير صالح").nullable().optional()),
  password: z.string({ required_error: "كلمة المرور مطلوبة" }).min(8),
  role: z.enum(["admin", "employee", "owner", "secretary", "teacher"]).optional().default("employee"),
});

export const UpdateUserSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().min(2).optional()),
  email: z.preprocess(emptyToNull, z.string().email().nullable().optional()),
  role: z.enum(["admin", "employee", "owner", "secretary", "teacher"]).optional(),
  is_active: z.union([z.boolean(), z.number().transform(Boolean)]).optional(),
});

// ─── Settings Schema ──────────────────────────────────────────────────────────

export const UpdateSettingsSchema = z.object({
  center: z.object({
    centerName: z.string().trim().min(1).optional(),
    logoUrl: z.preprocess(emptyToNull, z.string().nullable().optional()),
    phone: z.preprocess(emptyToNull, z.string().nullable().optional()),
    secondaryPhone: z.preprocess(emptyToNull, z.string().nullable().optional()),
    address: z.preprocess(emptyToNull, z.string().nullable().optional()),
    academicYear: z.preprocess(emptyToNull, z.string().nullable().optional()),
    currency: z.string().optional().default("EGP"),
  }).optional(),
  attendance: z.object({
    enabled: z.boolean().optional(),
    checkOutEnabled: z.boolean().optional(),
    locationEnabled: z.boolean().optional(),
    passwordEnabled: z.boolean().optional(),
    allowedRadiusMeters: z.number().int().min(10).max(10000).optional(),
  }).optional(),
  notifications: z.object({
    whatsappEnabled: z.boolean().optional(),
    resultMessagesEnabled: z.boolean().optional(),
    attendanceMessagesEnabled: z.boolean().optional(),
    checkOutMessagesEnabled: z.boolean().optional(),
    absenceMessagesEnabled: z.boolean().optional(),
  }).optional(),
  modules: z.record(z.string(), z.boolean()).optional(),
  paymentsEnabled: z.boolean().optional(),
  reportsEnabled: z.boolean().optional(),
});

// ─── Notification / Broadcast Schemas ─────────────────────────────────────────

// حد المرفق: 3MB خام ≈ 4MB base64 — آمن تحت حد JSON البالغ 5mb
const MAX_ATTACHMENT_CHARS = 4200000;
const ALLOWED_ATTACHMENT_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const;

const AttachmentSchema = z.object({
  data: z.string().trim().min(100, "بيانات المرفق غير صالحة").max(MAX_ATTACHMENT_CHARS, "حجم المرفق يتجاوز الحد المسموح (3MB)"),
  name: z.string().trim().min(1, "اسم المرفق مطلوب").max(150),
  mime: z.enum(ALLOWED_ATTACHMENT_MIMES as unknown as [string, ...string[]]),
  size: z.number().int().positive().max(3 * 1024 * 1024, "حجم المرفق يتجاوز الحد المسموح (3MB)"),
}).refine((a) => a.data.startsWith(`data:${a.mime};base64,`), {
  message: "صيغة بيانات المرفق غير صالحة",
  path: ["data"],
});

// ─── Notification / Broadcast Schemas ─────────────────────────────────────────

// يقبل مفردات الواجهة (individual/group/...) ويرجعها كما هي —
// قيد CHECK في DB يغطيها جميعاً بعد Migration 6.
const NotificationTypeSchema = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (typeof v !== "string") return "general";
  const t = v.trim();
  if (t === "examResult") return "exam_result";
  if (t === "checkOut") return "check_out";
  return t || "general";
}, z.enum([
  "check_in", "check_out", "exam_result", "fee_reminder", "payment_receipt",
  "absence", "general", "individual", "group", "notification", "reminder", "attendance",
  "examResult", "checkOut",
]));

const NotificationStatusSchema = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !v.trim()) return "pending";
  return v.trim();
}, z.enum(["pending", "processing", "sent", "failed", "draft", "scheduled"]));

const isoDateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ يجب أن يكون بصيغة YYYY-MM-DD");

export const CreateNotificationSchema = z.object({
  title: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  message: z.preprocess(emptyToUndefined, z.string().trim().min(1, "محتوى الرسالة مطلوب").optional()),
  body: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  content: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  type: NotificationTypeSchema.optional().default("general"),
  status: NotificationStatusSchema.optional().default("pending"),
  recipientType: z.enum(["student", "groups"]).optional(),
  studentId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  groupIds: z.array(z.string().min(1)).optional(),
  groupIDs: z.array(z.string().min(1)).optional(),
  recipientPhone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  scheduledDate: z.preprocess(emptyToUndefined, isoDateString.optional()),
  scheduledTime: z.preprocess(emptyToUndefined, z.string().trim().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "الوقت يجب أن يكون بصيغة HH:mm").optional()),
  scheduledAt: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  attachment: AttachmentSchema.nullable().optional(),
  accountId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  account_id: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
}).refine((d) => Boolean(d.message || d.body || d.content), {
  message: "محتوى الرسالة مطلوب",
  path: ["message"],
});

export const UpdateNotificationSchema = z.object({
  title: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  message: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  body: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  content: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  type: NotificationTypeSchema.optional(),
  status: NotificationStatusSchema.optional(),
  recipientPhone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  scheduledDate: z.preprocess(emptyToUndefined, isoDateString.optional()),
  scheduledTime: z.preprocess(emptyToUndefined, z.string().trim().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "الوقت يجب أن يكون بصيغة HH:mm").optional()),
  scheduledAt: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  attachment: AttachmentSchema.nullable().optional(),
  accountId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  account_id: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
});

// ─── WhatsApp Account Schemas ─────────────────────────────────────────────────

const phoneNumber = z.string().trim().min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل").max(20);

export const CreateWhatsAppAccountSchema = z.object({
  phoneNumber,
  providerName: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(50).optional()).optional().default("custom"),
  apiUrl: z.string({ required_error: "رابط الـ API مطلوب" }).trim().url("رابط الـ API غير صالح"),
  apiToken: z.string({ required_error: "مفتاح الـ API مطلوب" }).trim().min(1, "مفتاح الـ API مطلوب").max(500),
  isDefault: z.boolean().optional().default(false),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export const UpdateWhatsAppAccountSchema = z.object({
  phoneNumber: z.preprocess(emptyToUndefined, phoneNumber.optional()),
  providerName: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(50).optional()),
  apiUrl: z.preprocess(emptyToUndefined, z.string().trim().url("رابط الـ API غير صالح").optional()),
  apiToken: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(500).optional()),
  isDefault: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const TestWhatsAppAccountSchema = z.object({
  phone: z.string({ required_error: "رقم هاتف الاختبار مطلوب" }).trim().min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل").max(20),
  message: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(1000).optional()),
});

// ─── Lesson Schema ────────────────────────────────────────────────────────────

// يقبل مفردات الحالة من الـ Frontend (upcoming/ongoing/...) والـ Backend (scheduled/...)
const LessonStatusSchema = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const map: Record<string, string> = {
    upcoming: "scheduled",
    scheduled: "scheduled",
    "قادمة": "scheduled",
    ongoing: "in_progress",
    in_progress: "in_progress",
    "جارية": "in_progress",
    completed: "completed",
    "مكتملة": "completed",
    cancelled: "cancelled",
    canceled: "cancelled",
    "ملغاة": "cancelled",
  };
  return map[v.trim()] ?? v;
}, z.enum(["scheduled", "in_progress", "completed", "cancelled"]));

export const CreateLessonSchema = z.object({
  groupId: z.preprocess(emptyToUndefined, z.string().min(1).optional()), // may come from URL param
  title: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  subject: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  teacherId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  room: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  date: z.string({ required_error: "تاريخ الحصة مطلوب" }).trim().min(1),
  time: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  startTime: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  endTime: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  duration: z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return undefined;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    }
    return v;
  }, z.number().int().positive().max(1440).optional()),
  status: LessonStatusSchema.optional().default("scheduled"),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
}).refine((d) => (d.title && d.title.length >= 1) || (d.subject && d.subject.length >= 1), {
  message: "عنوان الحصة أو المادة مطلوب",
  path: ["title"],
}).refine((d) => Boolean(d.time || d.startTime), {
  message: "وقت البداية مطلوب",
  path: ["startTime"],
});

export const UpdateLessonSchema = z.object({
  groupId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  title: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  subject: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  teacherId: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  room: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  date: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  time: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  startTime: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  endTime: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  duration: z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return undefined;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    }
    return v;
  }, z.number().int().positive().max(1440).optional()),
  status: LessonStatusSchema.optional(),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
});
