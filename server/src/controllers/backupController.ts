import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { backupService } from "../services/backupService.js";
import { sendSuccess } from "../utils/response.js";

export const backupController = {
  list(req: AuthRequest, res: Response) {
    const backups = backupService.listBackups();
    return sendSuccess(res, backups);
  },

  async create(req: AuthRequest, res: Response) {
    const backup = await backupService.createBackup(req.user?.id, req.ip);
    return sendSuccess(res, backup, "تم إنشاء النسخة الاحتياطية بنجاح", 201);
  },

  restore(req: AuthRequest, res: Response) {
    const { filename } = req.body;
    backupService.restoreBackup(filename, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم استعادة النسخة الاحتياطية بنجاح");
  },
};
