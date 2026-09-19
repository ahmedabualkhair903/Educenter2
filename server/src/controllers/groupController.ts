import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { groupService } from "../services/groupService.js";
import { sendSuccess } from "../utils/response.js";

export const groupController = {
  list(req: AuthRequest, res: Response) {
    const filters = {
      grade: req.query.grade as string | undefined,
      status: req.query.status as string | undefined,
      teacherId: (req.query.teacherId || req.query.teacher_id) as string | undefined,
    };
    const groups = groupService.listAll(filters);
    return sendSuccess(res, groups);
  },

  getById(req: AuthRequest, res: Response) {
    const group = groupService.getById(req.params.id);
    return sendSuccess(res, group);
  },

  create(req: AuthRequest, res: Response) {
    const group = groupService.create(req.body, req.user?.id, req.ip);
    return sendSuccess(res, group, "تم إنشاء المجموعة بنجاح", 201);
  },

  update(req: AuthRequest, res: Response) {
    const group = groupService.update(req.params.id, req.body, req.user?.id, req.ip);
    return sendSuccess(res, group, "تم تحديث المجموعة بنجاح");
  },

  delete(req: AuthRequest, res: Response) {
    groupService.delete(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم حذف المجموعة بنجاح");
  },

  listStudents(req: AuthRequest, res: Response) {
    const students = groupService.listStudents(req.params.id);
    return sendSuccess(res, students);
  },

  enrollStudent(req: AuthRequest, res: Response) {
    const { studentId } = req.body;
    groupService.enrollStudent(req.params.id, studentId, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم تسجيل الطالب في المجموعة بنجاح");
  },

  removeStudent(req: AuthRequest, res: Response) {
    groupService.removeStudent(req.params.id, req.params.studentId, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم إزالة الطالب من المجموعة بنجاح");
  },
};
