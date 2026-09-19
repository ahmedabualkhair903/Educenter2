import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { studentService } from "../services/studentService.js";
import { AppError, sendError, sendSuccess } from "../utils/response.js";
import { logger } from "../utils/logger.js";

function sanitizeStudentForRole(student: any, role?: string) {
  if (!student) return student;
  if (role === "teacher") {
    return {
      ...student,
      phone: student.phone ? `${student.phone.slice(0, 3)}****${student.phone.slice(-3)}` : null,
      guardianPhone: student.guardianPhone ? `${student.guardianPhone.slice(0, 3)}****${student.guardianPhone.slice(-3)}` : null,
    };
  }
  return student;
}

export const studentController = {
  list(req: AuthRequest, res: Response) {
    const filters = {
      search: req.query.search as string | undefined,
      grade: req.query.grade as string | undefined,
      groupId: (req.query.groupId || req.query.group_id) as string | undefined,
      teacherId: (req.query.teacherId || req.query.teacher_id) as string | undefined,
      status: req.query.status as string | undefined,
      paymentStatus: req.query.paymentStatus as any,
      page: req.query.page ? Number.parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 50,
    };

    const { students, total } = studentService.list(filters);
    const totalPages = Math.ceil(total / filters.limit);
    const sanitizedStudents = students.map((s) => sanitizeStudentForRole(s, req.user?.role));

    return sendSuccess(res, sanitizedStudents, "تم جلب قائمة الطلاب", 200, {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages,
    });
  },

  searchFast(req: AuthRequest, res: Response) {
    const q = (req.query.q || req.query.search || "") as string;
    const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 20;
    const results = studentService.searchFast(q, limit);
    const sanitized = results.map((s) => sanitizeStudentForRole(s, req.user?.role));
    return sendSuccess(res, sanitized);
  },

  getById(req: AuthRequest, res: Response) {
    const student = studentService.getById(req.params.id);
    return sendSuccess(res, sanitizeStudentForRole(student, req.user?.role));
  },

  getByBarcode(req: AuthRequest, res: Response) {
    const student = studentService.getByBarcode(req.params.code);
    return sendSuccess(res, sanitizeStudentForRole(student, req.user?.role));
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const result = await studentService.create(req.body, req.user?.id, req.ip);
      // يُعاد الطالب مع ملخصه المالي (financial) وملخص العملية (finance)
      // ليظهر فوراً في صفحة المصروفات دون طلبات إضافية.
      return sendSuccess(
        res,
        result.finance
          ? { ...result.student, finance: result.finance }
          : result.student,
        result.finance
          ? `تم إضافة الطالب وتسجيل مصروفات ${result.finance.totalRequired} ج.م بنجاح`
          : "تم إضافة الطالب بنجاح",
        201
      );
    } catch (err: any) {
      logger.error("[studentController.create] Error:", {
        message: err?.message,
        code: err?.code,
        body: req.body,
      });
      // Foreign key violation: groupId أو academicYearId غير موجود
      if (err?.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
        return sendError(
          res,
          "المجموعة المحددة أو البيانات المرتبطة غير موجودة — تأكد من أن groupId صالح أو أرسله كـ null",
          400,
          "FOREIGN_KEY_VIOLATION"
        );
      }
      if (err instanceof AppError) {
        return sendError(res, err.message, err.statusCode, err.code, err.details);
      }
      throw err; // re-throw للـ global error handler
    }
  },

  async quickRegister(req: AuthRequest, res: Response) {
    try {
      const student = await studentService.quickRegister(req.body, req.user?.id, req.ip);
      return sendSuccess(res, student, "تم تسجيل الطالب سريعًا بنجاح", 201);
    } catch (err: any) {
      logger.error("[studentController.quickRegister] Error:", {
        message: err?.message,
        code: err?.code,
        body: req.body,
      });
      if (err?.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
        return sendError(
          res,
          "المجموعة المحددة غير موجودة — تأكد من أن group_id صالح أو أرسله كـ null",
          400,
          "FOREIGN_KEY_VIOLATION"
        );
      }
      if (err instanceof AppError) {
        return sendError(res, err.message, err.statusCode, err.code, err.details);
      }
      throw err;
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const updated = await studentService.update(req.params.id, req.body, req.user?.id, req.ip);
      return sendSuccess(res, updated, "تم تحديث بيانات الطالب بنجاح");
    } catch (err: any) {
      logger.error("[studentController.update] Error:", {
        message: err?.message,
        code: err?.code,
        studentId: req.params.id,
        body: req.body,
      });
      if (err?.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
        return sendError(
          res,
          "المجموعة المحددة غير موجودة — تأكد من أن groupId صالح أو أرسله كـ null",
          400,
          "FOREIGN_KEY_VIOLATION"
        );
      }
      if (err instanceof AppError) {
        return sendError(res, err.message, err.statusCode, err.code, err.details);
      }
      throw err;
    }
  },

  delete(req: AuthRequest, res: Response) {
    studentService.delete(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم حذف الطالب بنجاح");
  },

  async getCard(req: AuthRequest, res: Response) {
    const cardData = await studentService.getStudentCard(req.params.id);
    return sendSuccess(res, cardData);
  },

  checkDuplicates(req: AuthRequest, res: Response) {
    const { studentCode, phone, guardianPhone, name, excludeId } = req.query as any;
    const matches = studentService.checkDuplicates({
      studentCode,
      phone,
      guardianPhone,
      name,
      excludeId,
    });
    return sendSuccess(res, {
      duplicateWarning: matches.length > 0,
      possibleMatches: matches,
    });
  },

  listCustomFields(req: AuthRequest, res: Response) {
    const fields = studentService.listCustomFields();
    return sendSuccess(res, fields);
  },

  createCustomField(req: AuthRequest, res: Response) {
    const field = studentService.createCustomField(req.body);
    return sendSuccess(res, field, "تم إضافة الحقل المخصص بنجاح", 201);
  },

  deleteCustomField(req: AuthRequest, res: Response) {
    studentService.deleteCustomField(req.params.id);
    return sendSuccess(res, null, "تم حذف الحقل المخصص بنجاح");
  },
};
