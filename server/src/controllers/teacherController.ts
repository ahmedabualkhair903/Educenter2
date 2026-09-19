import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { teacherService } from "../services/teacherService.js";
import { sendSuccess } from "../utils/response.js";

export const teacherController = {
  list(req: AuthRequest, res: Response) {
    const teachers = teacherService.listAll();
    return sendSuccess(res, teachers);
  },

  getById(req: AuthRequest, res: Response) {
    const teacher = teacherService.getById(req.params.id);
    return sendSuccess(res, teacher);
  },

  getStats(req: AuthRequest, res: Response) {
    const stats = teacherService.getStats(req.params.id);
    return sendSuccess(res, stats);
  },

  create(req: AuthRequest, res: Response) {
    const teacher = teacherService.create(req.body, req.user?.id, req.ip);
    return sendSuccess(res, teacher, "تم إضافة المدرس بنجاح", 201);
  },

  update(req: AuthRequest, res: Response) {
    const teacher = teacherService.update(req.params.id, req.body, req.user?.id, req.ip);
    return sendSuccess(res, teacher, "تم تحديث بيانات المدرس بنجاح");
  },

  delete(req: AuthRequest, res: Response) {
    teacherService.delete(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم حذف المدرس بنجاح");
  },
};
