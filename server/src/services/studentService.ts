import crypto from "node:crypto";
import QRCode from "qrcode";
import { getDatabase } from "../database/db.js";
import { logAudit } from "../middleware/audit.js";
import type { Student, StudentCustomFieldDefinition, StudentCustomFieldValue } from "../models/index.js";
import { feeRepository } from "../repositories/feeRepository.js";
import { groupRepository } from "../repositories/groupRepository.js";
import { paymentRepository } from "../repositories/paymentRepository.js";
import { studentRepository, type StudentFilters } from "../repositories/studentRepository.js";
import { AppError } from "../utils/response.js";
import { notificationService } from "./notificationService.js";

export type StudentFinanceInput = {
  totalRequired: number;
  initialPayment?: number;
  paymentMethod?: "cash" | "bank_transfer" | "vodafone_cash" | "instapay" | "other";
  period?: string;
  dueDate?: string;
};

export const studentService = {
  list(filters: StudentFilters) {
    return studentRepository.list(filters);
  },

  searchFast(queryStr: string, limit = 20): Student[] {
    if (!queryStr || !queryStr.trim()) return [];
    return studentRepository.searchFast(queryStr, limit);
  },

  getById(id: string): Student {
    const student = studentRepository.findById(id);
    if (!student) {
      throw new AppError("الطالب غير موجود", 404, "STUDENT_NOT_FOUND");
    }
    return student;
  },

  getByBarcode(barcode: string): Student {
    const student = studentRepository.findByCode(barcode);
    if (!student) {
      throw new AppError("الطالب غير موجود بهذا الباركود", 404, "STUDENT_NOT_FOUND");
    }
    return student;
  },

  checkDuplicates(params: {
    studentCode?: string;
    phone?: string;
    guardianPhone?: string;
    name?: string;
    excludeId?: string;
  }): Student[] {
    return studentRepository.findPossibleDuplicates(params);
  },

  async create(data: {
    // NOTE: student_code is NEVER accepted from the client — auto-generated as STU-YYYY-XXXX.
    name: string;
    phone?: string | null;
    guardianName: string;
    guardianPhone: string;
    gender?: string;
    birthDate?: string | null;
    schoolName?: string | null;
    schoolGrade?: string | null;
    grade: string;
    groupId?: string | null;
    address?: string | null;
    notes?: string | null;
    status?: "active" | "inactive" | "suspended";
    customFields?: StudentCustomFieldValue[];
    /** بيانات مالية اختيارية تُنشأ ذرياً مع الطالب (فاتورة + دفعة أولى) */
    finance?: StudentFinanceInput;
  }, creatorId?: string, ip?: string): Promise<{ student: Student; finance?: { feeId: string; paymentId?: string; totalRequired: number; paid: number; remaining: number; status: "paid" | "partial" | "unpaid" }; duplicateWarning?: boolean; possibleMatches?: Student[] }> {
    // ─── تحقق مالي مبكر قبل أي كتابة (يمنع حالات جزئية) ───
    const finance = data.finance;
    const totalRequired = finance ? Number(finance.totalRequired) : 0;
    const initialPayment = finance ? Number(finance.initialPayment ?? 0) : 0;
    const paymentMethod = finance?.paymentMethod || "cash";
    if (finance) {
      if (!Number.isFinite(totalRequired) || totalRequired <= 0) {
        throw new AppError("إجمالي المصروفات يجب أن يكون أكبر من صفر", 400, "INVALID_TOTAL_FEES");
      }
      if (!Number.isFinite(initialPayment) || initialPayment < 0) {
        throw new AppError("المبلغ المدفوع لا يمكن أن يكون سالباً", 400, "INVALID_PAID_AMOUNT");
      }
      if (initialPayment > totalRequired) {
        throw new AppError("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي المصروفات", 400, "OVERPAYMENT_NOT_ALLOWED");
      }
      if (!["cash", "bank_transfer", "vodafone_cash", "instapay", "other"].includes(paymentMethod)) {
        throw new AppError("طريقة الدفع غير صالحة", 400, "INVALID_PAYMENT_METHOD");
      }
    }

    // Check duplicate warnings (phone / guardian phone) — no code involved
    const possibleMatches = studentRepository.findPossibleDuplicates({
      phone: data.phone || undefined,
      guardianPhone: data.guardianPhone,
      name: data.name,
    });

    // ─── توليد تلقائي + إنشاء ذري مع إعادة المحاولة عند تعارض UNIQUE ───
    // قيد UNIQUE على students(student_code) و students(barcode) هو الحكم النهائي:
    // إذا ولّد طلبان متزامنان نفس الكود، الخاسر يعيد التوليد تلقائياً.
    const MAX_ATTEMPTS = 5;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const studentCode = studentRepository.getNextStudentCode();
      const id = crypto.randomUUID();
      const barcode = studentCode;
      const guardianBarcode = `G-${studentCode}`;
      const now = new Date().toISOString();
      const today = now.split("T")[0];
      const feeId = crypto.randomUUID();
      const paymentId = crypto.randomUUID();

      try {
        // ─── إنشاء ذري واحد: طالب + فاتورة + دفعة أولى + حالة ───
        const db = getDatabase();
        db.transaction(() => {
          studentRepository.create({
            id,
            student_code: studentCode,
            full_name: data.name.trim(),
            phone: data.phone?.trim() || null,
            guardian_name: data.guardianName.trim(),
            guardian_phone: data.guardianPhone.trim(),
            gender: data.gender || "male",
            birth_date: data.birthDate || null,
            school_name: data.schoolName || null,
            school_grade: data.schoolGrade || null,
            grade: data.grade.trim(),
        group_id: data.groupId || null,
        address: data.address || null,
        notes: data.notes || null,
        status: data.status || "active",
        barcode,
        guardian_barcode: guardianBarcode,
        custom_fields: JSON.stringify(data.customFields || []),
        created_by: creatorId || null,
        sync_id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      });

      if (data.groupId) {
        groupRepository.enrollStudent(id, data.groupId);
      }

      if (finance) {
        const amountAfterDiscount = totalRequired;
        const feeStatus: "paid" | "partial" | "unpaid" =
          initialPayment >= amountAfterDiscount ? "paid"
          : initialPayment > 0 ? "partial"
          : "unpaid";

        feeRepository.create({
          id: feeId,
          student_id: id,
          group_id: data.groupId || null,
          amount_required: totalRequired,
          discount: 0,
          amount_after_discount: amountAfterDiscount,
          period: finance.period?.trim() || today.slice(0, 7),
          due_date: finance.dueDate || today,
          status: feeStatus,
          sync_id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        });

        if (initialPayment > 0) {
          paymentRepository.create({
            id: paymentId,
            student_id: id,
            fee_id: feeId,
            amount: initialPayment,
            payment_method: paymentMethod,
            payment_date: today,
            notes: "دفعة أولى عند التسجيل",
            received_by: creatorId || null,
            idempotency_key: null,
            sync_id: crypto.randomUUID(),
            created_at: now,
          });
        }
      }
        })();

        logAudit({
          userId: creatorId,
          action: "CREATE_STUDENT",
          entityType: "STUDENT",
          entityId: id,
          newData: { studentCode, name: data.name, phone: data.phone, guardianPhone: data.guardianPhone, grade: data.grade, groupId: data.groupId, finance: finance ? { totalRequired, initialPayment, paymentMethod } : undefined },
          ip,
        });

        let financeSummary: { feeId: string; paymentId?: string; totalRequired: number; paid: number; remaining: number; status: "paid" | "partial" | "unpaid" } | undefined;
        if (finance) {
          const remaining = Math.max(0, totalRequired - initialPayment);
          financeSummary = {
            feeId,
            paymentId: initialPayment > 0 ? paymentId : undefined,
            totalRequired,
            paid: initialPayment,
            remaining,
            status: initialPayment >= totalRequired ? "paid" : initialPayment > 0 ? "partial" : "unpaid",
          };

          logAudit({
            userId: creatorId,
            action: "CREATE_FEE",
            entityType: "FEE",
            entityId: feeId,
            newData: { studentName: data.name.trim(), amountRequired: totalRequired, initialPayment, paymentMethod, status: financeSummary.status },
            ip,
          });

          if (initialPayment > 0) {
            logAudit({
              userId: creatorId,
              action: "RECORD_PAYMENT",
              entityType: "PAYMENT",
              entityId: paymentId,
              newData: { studentName: data.name.trim(), amount: initialPayment, paymentMethod, remaining },
              ip,
            });

            // إشعار واتساب بإيصال الدفعة الأولى (بعد الـ commit — مثل recordPayment)
            const recipientPhone = data.guardianPhone?.trim() || data.phone?.trim();
            if (recipientPhone) {
              notificationService.onPaymentReceipt(
                data.name.trim(),
                recipientPhone,
                initialPayment,
                remaining,
                id
              );
            }
          }
        }

        const created = studentRepository.findById(id)!;
        return {
          student: created,
          finance: financeSummary,
          duplicateWarning: possibleMatches.length > 0,
          possibleMatches: possibleMatches.length > 0 ? possibleMatches : undefined,
        };
      } catch (err: any) {
        const msg = String(err?.message || "");
        const code = String(err?.code || "");
        const isUniqueViolation =
          code.includes("SQLITE_CONSTRAINT_UNIQUE") ||
          msg.includes("UNIQUE constraint failed: students.student_code") ||
          msg.includes("UNIQUE constraint failed: students.barcode");
        if (isUniqueViolation && attempt < MAX_ATTEMPTS - 1) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError instanceof Error ? lastError : new AppError("تعذر توليد كود فريد للطالب، حاول مرة أخرى", 500, "STUDENT_CODE_GENERATION_FAILED");
  },

  async quickRegister(data: {
    full_name: string;
    phone?: string | null;
    guardian_phone: string;
    guardian_name?: string | null;
    grade: string;
    group_id?: string | null;
  }, creatorId?: string, ip?: string): Promise<Student> {
    // Auto-generation with retry on UNIQUE violation (race-condition safe)
    const MAX_ATTEMPTS = 5;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const studentCode = studentRepository.getNextStudentCode();
      const id = crypto.randomUUID();
      const barcode = studentCode;
      const guardianBarcode = `G-${studentCode}`;
      const now = new Date().toISOString();

      try {
        studentRepository.create({
          id,
          student_code: studentCode,
          full_name: data.full_name.trim(),
          phone: data.phone?.trim() || null,
          guardian_name: (data.guardian_name || `ولي أمر ${data.full_name}`).trim(),
          guardian_phone: data.guardian_phone.trim(),
          gender: "male",
          grade: data.grade.trim(),
          group_id: data.group_id || null,
          status: "active",
          barcode,
          guardian_barcode: guardianBarcode,
          custom_fields: "[]",
          created_by: creatorId || null,
          sync_id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        });

        if (data.group_id) {
          groupRepository.enrollStudent(id, data.group_id);
        }

        logAudit({
          userId: creatorId,
          action: "QUICK_REGISTER_STUDENT",
          entityType: "STUDENT",
          entityId: id,
          newData: { studentCode, name: data.full_name, guardianPhone: data.guardian_phone, grade: data.grade },
          ip,
        });

        return studentRepository.findById(id)!;
      } catch (err: any) {
        const msg = String(err?.message || "");
        const code = String(err?.code || "");
        const isUniqueViolation =
          code.includes("SQLITE_CONSTRAINT_UNIQUE") ||
          msg.includes("UNIQUE constraint failed: students.student_code") ||
          msg.includes("UNIQUE constraint failed: students.barcode");
        if (isUniqueViolation && attempt < MAX_ATTEMPTS - 1) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new AppError("تعذر توليد كود فريد للطالب، حاول مرة أخرى", 500, "STUDENT_CODE_GENERATION_FAILED");
  },

  async update(id: string, updates: Partial<any>, updaterId?: string, ip?: string): Promise<Student> {
    const student = studentRepository.findById(id);
    if (!student) {
      throw new AppError("الطالب غير موجود", 404, "STUDENT_NOT_FOUND");
    }

    // student_code is immutable — auto-generated once at creation and never editable.
    // Silently drop legacy keys (studentId / student_code / studentCode) so old
    // clients that still send them don't break; reject only an actual change attempt.
    const attemptedCode =
      updates.studentId ?? updates.student_code ?? updates.studentCode ?? updates.code;
    if (attemptedCode !== undefined && String(attemptedCode).trim() !== "" && String(attemptedCode).trim() !== student.studentId) {
      throw new AppError("كود الطالب يتم توليده تلقائياً ولا يمكن تعديله", 400, "STUDENT_CODE_IMMUTABLE");
    }

    const payload: any = {};
    if (updates.name !== undefined) payload.full_name = updates.name.trim();
    if (updates.phone !== undefined) payload.phone = updates.phone ? updates.phone.trim() : null;
    if (updates.guardianName !== undefined) payload.guardian_name = updates.guardianName.trim();
    if (updates.guardianPhone !== undefined) payload.guardian_phone = updates.guardianPhone.trim();
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.birthDate !== undefined) payload.birth_date = updates.birthDate;
    if (updates.schoolName !== undefined) payload.school_name = updates.schoolName;
    if (updates.schoolGrade !== undefined) payload.school_grade = updates.schoolGrade;
    if (updates.grade !== undefined) payload.grade = updates.grade.trim();
    if (updates.groupId !== undefined) payload.group_id = updates.groupId || null;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.customFields !== undefined) payload.custom_fields = JSON.stringify(updates.customFields);

    studentRepository.update(id, payload);

    if (updates.groupId !== undefined && updates.groupId !== student.groupId) {
      if (updates.groupId) {
        groupRepository.enrollStudent(id, updates.groupId);
      } else if (student.groupId) {
        groupRepository.removeStudentFromGroup(id, student.groupId);
      }
    }

    logAudit({
      userId: updaterId,
      action: "UPDATE_STUDENT",
      entityType: "STUDENT",
      entityId: id,
      oldData: student,
      newData: updates,
      ip,
    });

    return studentRepository.findById(id)!;
  },

  delete(id: string, deletedBy?: string, ip?: string): boolean {
    const student = studentRepository.findById(id);
    if (!student) {
      throw new AppError("الطالب غير موجود", 404, "STUDENT_NOT_FOUND");
    }

    const summary = studentRepository.getFinancialSummary(id);
    if (summary.remaining > 0) {
      throw new AppError(
        `لا يمكن حذف الطالب قبل سداد المستحقات المتبقية (${summary.remaining} ج.م)`,
        400,
        "STUDENT_HAS_DUES"
      );
    }

    studentRepository.softDelete(id, deletedBy);

    logAudit({
      userId: deletedBy,
      action: "SOFT_DELETE_STUDENT",
      entityType: "STUDENT",
      entityId: id,
      oldData: student,
      ip,
    });

    return true;
  },

  async getStudentCard(id: string): Promise<{
    student: Student;
    qrCodeDataUrl: string;
    guardianQrCodeDataUrl: string;
  }> {
    const student = studentRepository.findById(id);
    if (!student) {
      throw new AppError("الطالب غير موجود", 404, "STUDENT_NOT_FOUND");
    }

    const qrCodeDataUrl = await QRCode.toDataURL(student.barcode, { width: 250, margin: 1 });
    const guardianQrCodeDataUrl = await QRCode.toDataURL(student.guardianBarcode || `G-${student.barcode}`, { width: 250, margin: 1 });

    return {
      student,
      qrCodeDataUrl,
      guardianQrCodeDataUrl,
    };
  },

  // Custom field definitions
  listCustomFields(): StudentCustomFieldDefinition[] {
    return studentRepository.listCustomFieldDefinitions();
  },

  createCustomField(def: StudentCustomFieldDefinition): StudentCustomFieldDefinition {
    studentRepository.createCustomFieldDefinition(def);
    return def;
  },

  deleteCustomField(id: string): void {
    studentRepository.deleteCustomFieldDefinition(id);
  },
};
