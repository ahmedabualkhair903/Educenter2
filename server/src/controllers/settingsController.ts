import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { settingsService } from "../services/settingsService.js";
import { sendSuccess } from "../utils/response.js";

export const settingsController = {
  get(req: AuthRequest, res: Response) {
    const settings = settingsService.getSettings();
    return sendSuccess(res, settings);
  },

  update(req: AuthRequest, res: Response) {
    const updated = settingsService.updateSettings(req.body, req.user?.id, req.ip);
    return sendSuccess(res, updated, "تم تحديث الإعدادات بنجاح");
  },

  getRooms(req: AuthRequest, res: Response) {
    const rooms = settingsService.getRooms();
    return sendSuccess(res, rooms);
  },

  addRoom(req: AuthRequest, res: Response) {
    const rooms = settingsService.addRoom(req.body?.name ?? "", req.user?.id, req.ip);
    return sendSuccess(res, rooms, "تمت إضافة القاعة بنجاح", 201);
  },

  getSubjects(req: AuthRequest, res: Response) {
    const subjects = settingsService.getSubjects();
    return sendSuccess(res, subjects);
  },

  addSubject(req: AuthRequest, res: Response) {
    const subjects = settingsService.addSubject(req.body?.name ?? "", req.user?.id, req.ip);
    return sendSuccess(res, subjects, "تمت إضافة المادة بنجاح", 201);
  },
};
