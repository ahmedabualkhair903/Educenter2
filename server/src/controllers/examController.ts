import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { examService } from "../services/examService.js";
import { sendSuccess } from "../utils/response.js";

export const examController = {
  list(req: AuthRequest, res: Response) {
    const filters = {
      groupId: (req.query.groupId || req.query.group_id) as string | undefined,
      subject: req.query.subject as string | undefined,
    };
    const exams = examService.listAll(filters);
    return sendSuccess(res, exams);
  },

  getById(req: AuthRequest, res: Response) {
    const exam = examService.getById(req.params.id);
    return sendSuccess(res, exam);
  },

  create(req: AuthRequest, res: Response) {
    const exam = examService.create(req.body, req.user?.id, req.ip);
    return sendSuccess(res, exam, "تم إنشاء الاختبار بنجاح", 201);
  },

  update(req: AuthRequest, res: Response) {
    const exam = examService.update(req.params.id, req.body, req.user?.id, req.ip);
    return sendSuccess(res, exam, "تم تحديث الاختبار بنجاح");
  },

  delete(req: AuthRequest, res: Response) {
    examService.delete(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم حذف الاختبار بنجاح");
  },

  listResults(req: AuthRequest, res: Response) {
    const results = examService.listResults(req.params.id);
    return sendSuccess(res, results);
  },

  listAllResults(req: AuthRequest, res: Response) {
    const filters = {
      examId: (req.query.examId || req.query.exam_id) as string | undefined,
      studentId: (req.query.studentId || req.query.student_id) as string | undefined,
    };
    const results = examService.listAllResults(filters);
    return sendSuccess(res, results);
  },

  submitResults(req: AuthRequest, res: Response) {
    // توافق خلفي: الـ Frontend القديم يرسل كائن مفرد {studentId, score, status}
    // بينما الـ API الموثق يستقبل {results: [...]}. ندعم الصيغتين.
    const body = req.body ?? {};
    let results = body.results;
    if (!Array.isArray(results)) {
      if (body.studentId !== undefined || body.score !== undefined) {
        results = [{
          studentId: body.studentId,
          score: body.score ?? null,
          status: body.status,
          notes: body.notes,
        }];
      } else {
        results = [];
      }
    }
    const updated = examService.submitResults(req.params.id, results, req.user?.id, req.ip);
    return sendSuccess(res, updated, "تم رصد درجات الاختبار بنجاح");
  },

  listResultsByStudent(req: AuthRequest, res: Response) {
    const results = examService.listResultsByStudent(req.params.studentId);
    return sendSuccess(res, results);
  },

  getResultByStudent(req: AuthRequest, res: Response) {
    const result = examService.getResultByStudent(req.params.examId, req.params.studentId);
    return sendSuccess(res, result);
  },

  updateGrade(req: AuthRequest, res: Response) {
    const updated = examService.updateGrade(req.params.id, req.body, req.user?.id, req.ip);
    return sendSuccess(res, updated, "تم تحديث الدرجة بنجاح");
  },

  deleteGrade(req: AuthRequest, res: Response) {
    examService.deleteGrade(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم حذف الدرجة بنجاح");
  },
};
