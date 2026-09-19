import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { authService } from "../services/authService.js";
import { sendSuccess } from "../utils/response.js";

export const userController = {
  list(req: AuthRequest, res: Response) {
    const users = authService.listUsers();
    return sendSuccess(res, users);
  },

  async create(req: AuthRequest, res: Response) {
    const user = await authService.createUser(req.body, req.user?.id, req.ip);
    return sendSuccess(res, user, "تم إنشاء المستخدم بنجاح", 201);
  },

  async update(req: AuthRequest, res: Response) {
    const user = await authService.updateUser(req.params.id, req.body, req.user?.id, req.ip);
    return sendSuccess(res, user, "تم تحديث بيانات المستخدم بنجاح");
  },

  async disable(req: AuthRequest, res: Response) {
    const user = await authService.updateUser(req.params.id, { isActive: false }, req.user?.id, req.ip);
    return sendSuccess(res, user, "تم تعطيل الحساب بنجاح");
  },

  async resetPassword(req: AuthRequest, res: Response) {
    const { newPassword } = req.body;
    await authService.resetPassword(req.params.id, newPassword, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم إعادة تعيين كلمة المرور بنجاح");
  },
};
