import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { whatsappAccountService } from "../services/whatsappAccountService.js";
import { sendSuccess } from "../utils/response.js";

export const whatsappAccountController = {
  list(req: AuthRequest, res: Response) {
    const accounts = whatsappAccountService.listAll();
    return sendSuccess(res, accounts);
  },

  getById(req: AuthRequest, res: Response) {
    const account = whatsappAccountService.getById(req.params.id);
    return sendSuccess(res, account);
  },

  create(req: AuthRequest, res: Response) {
    const account = whatsappAccountService.create(req.body, req.user?.id, req.ip);
    return sendSuccess(res, account, "تمت إضافة حساب الواتساب بنجاح", 201);
  },

  update(req: AuthRequest, res: Response) {
    const account = whatsappAccountService.update(req.params.id, req.body, req.user?.id, req.ip);
    return sendSuccess(res, account, "تم تحديث حساب الواتساب بنجاح");
  },

  delete(req: AuthRequest, res: Response) {
    const result = whatsappAccountService.delete(req.params.id, req.user?.id, req.ip);
    return sendSuccess(
      res,
      result,
      result.promotedDefaultId
        ? "تم حذف الحساب وتعيين حساب افتراضي بديل تلقائياً"
        : "تم حذف حساب الواتساب بنجاح"
    );
  },

  setDefault(req: AuthRequest, res: Response) {
    const account = whatsappAccountService.setDefault(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, account, "تم تعيين الحساب كمرسل افتراضي بنجاح");
  },

  async test(req: AuthRequest, res: Response) {
    const { phone, message } = req.body;
    const result = await whatsappAccountService.testAccount(req.params.id, phone, message);
    return sendSuccess(
      res,
      result,
      result.success ? "تم إرسال رسالة الاختبار بنجاح" : `فشل الاختبار: ${result.error}`
    );
  },
};
