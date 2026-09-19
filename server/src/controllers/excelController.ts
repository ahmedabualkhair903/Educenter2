import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { excelService } from "../services/excelService.js";
import { AppError, sendSuccess } from "../utils/response.js";

export const excelController = {
  previewStudents(req: AuthRequest, res: Response) {
    if (!req.file || !req.file.buffer) {
      throw new AppError("يرجى رفع ملف Excel صالح", 400, "MISSING_FILE");
    }
    const preview = excelService.previewImportStudents(req.file.buffer);
    return sendSuccess(res, preview);
  },

  commitStudents(req: AuthRequest, res: Response) {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      throw new AppError("قائمة الطلاب فارغة", 400, "EMPTY_LIST");
    }
    const result = excelService.commitImportStudents(students, req.user?.id, req.ip);
    return sendSuccess(res, result, `تم استيراد ${result.importedCount} طالب بنجاح`);
  },

  previewResults(req: AuthRequest, res: Response) {
    if (!req.file || !req.file.buffer) {
      throw new AppError("يرجى رفع ملف Excel صالح", 400, "MISSING_FILE");
    }
    const examId = (req.body.examId || req.params.examId) as string;
    if (!examId) {
      throw new AppError("معرف الاختبار مطلوب", 400, "MISSING_EXAM_ID");
    }
    const preview = excelService.previewImportResults(examId, req.file.buffer);
    return sendSuccess(res, preview);
  },

  commitResults(req: AuthRequest, res: Response) {
    const examId = (req.body.examId || req.params.examId) as string;
    const { results } = req.body;
    if (!examId || !Array.isArray(results) || results.length === 0) {
      throw new AppError("معرف الاختبار أو قائمة النتائج فارغة", 400, "INVALID_DATA");
    }
    const updated = excelService.commitImportResults(examId, results, req.user?.id, req.ip);
    return sendSuccess(res, updated, `تم استيراد وحفظ درجات ${results.length} طالب بنجاح`);
  },

  directImportStudents(req: AuthRequest, res: Response) {
    if (!req.file || !req.file.buffer) {
      throw new AppError("يرجى رفع ملف Excel صالح", 400, "MISSING_FILE");
    }
    const result = excelService.directImportStudents(req.file.buffer, req.user?.id, req.ip);
    return sendSuccess(res, result, `تم استيراد ${result.importedCount} طالب وتخطي ${result.skippedCount} سجل غير صالح أو مكرر`);
  },

  directImportResults(req: AuthRequest, res: Response) {
    if (!req.file || !req.file.buffer) {
      throw new AppError("يرجى رفع ملف Excel صالح", 400, "MISSING_FILE");
    }
    const examId = (req.body.examId || req.params.examId) as string;
    if (!examId) {
      throw new AppError("معرف الاختبار مطلوب", 400, "MISSING_EXAM_ID");
    }
    const result = excelService.directImportResults(examId, req.file.buffer, req.user?.id, req.ip);
    return sendSuccess(res, result, `تم استيراد ${result.importedCount} نتيجة بنجاح`);
  },

  exportStudents(req: AuthRequest, res: Response) {
    const buffer = excelService.exportStudents(req.query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="students_${Date.now()}.xlsx"`);
    return res.send(buffer);
  },

  exportPayments(req: AuthRequest, res: Response) {
    const buffer = excelService.exportPayments(req.query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="payments_${Date.now()}.xlsx"`);
    return res.send(buffer);
  },

  exportAttendance(req: AuthRequest, res: Response) {
    const buffer = excelService.exportAttendance(req.query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="attendance_${Date.now()}.xlsx"`);
    return res.send(buffer);
  },

  exportFees(req: AuthRequest, res: Response) {
    const buffer = excelService.exportFees(req.query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="fees_${Date.now()}.xlsx"`);
    return res.send(buffer);
  },

  exportGroups(req: AuthRequest, res: Response) {
    const buffer = excelService.exportGroups(req.query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="groups_${Date.now()}.xlsx"`);
    return res.send(buffer);
  },

  exportTeachers(req: AuthRequest, res: Response) {
    const buffer = excelService.exportTeachers();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="teachers_${Date.now()}.xlsx"`);
    return res.send(buffer);
  },

  exportExamResults(req: AuthRequest, res: Response) {
    const buffer = excelService.exportExamResults(req.params.id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="exam_results_${req.params.id}.xlsx"`);
    return res.send(buffer);
  },
};
