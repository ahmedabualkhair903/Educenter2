import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { lessonService } from "../services/lessonService.js";
import { AppError, sendSuccess } from "../utils/response.js";

export const lessonController = {
  list(req: AuthRequest, res: Response) {
    const groupId = (req.query.groupId || req.query.group_id) as string | undefined;
    const lessons = lessonService.list({ groupId });
    return sendSuccess(res, lessons);
  },

  getById(req: AuthRequest, res: Response) {
    const lesson = lessonService.getById(req.params.id);
    return sendSuccess(res, lesson);
  },

  create(req: AuthRequest, res: Response) {
    const groupId = req.params.groupId || req.body.groupId;
    if (!groupId || (typeof groupId === "string" && !groupId.trim())) {
      throw new AppError("يرجى اختيار المجموعة أولاً", 400, "INVALID_GROUP_ID");
    }
    const lesson = lessonService.create(groupId, req.body, req.user?.id, req.ip);
    return sendSuccess(res, lesson, "تم إضافة الحصة بنجاح", 201);
  },

  update(req: AuthRequest, res: Response) {
    const lesson = lessonService.update(req.params.id, req.body, req.user?.id, req.ip);
    return sendSuccess(res, lesson, "تم تحديث بيانات الحصة بنجاح");
  },

  delete(req: AuthRequest, res: Response) {
    lessonService.delete(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم حذف الحصة بنجاح");
  },

  generate(req: AuthRequest, res: Response) {
    const months = req.body?.months
      ? Number(req.body.months)
      : 3;
    const result = lessonService.generateForGroup(
      req.params.id,
      { months },
    );
    return sendSuccess(
      res,
      result,
      `تم توليد ${result.created} حصة للمجموعة`
    );
  },

  cancelAlert(req: AuthRequest, res: Response) {
    const result = lessonService.cancelWithAlert(
      req.params.id,
      { message: req.body?.message },
      req.user?.id,
      req.ip,
    );
    return sendSuccess(
      res,
      result,
      `تم إلغاء الحصة وإرسال التنبيه إلى ${result.notifiedCount} من أولياء الأمور`
    );
  },
};
