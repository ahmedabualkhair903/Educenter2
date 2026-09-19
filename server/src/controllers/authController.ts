import type { Request, Response } from "express";
import { config } from "../config/index.js";
import type { AuthRequest } from "../middleware/auth.js";
import { authService } from "../services/authService.js";
import { sendSuccess } from "../utils/response.js";

/** Payload debug log with secrets masked — never print raw passwords. */
function logAuthPayload(action: string, body: Record<string, unknown>) {
  const masked = Object.fromEntries(
    Object.entries(body ?? {}).map(([key, value]) =>
      /password/i.test(key) ? [key, "***"] : [key, value],
    ),
  );
  console.log(`[auth.${action}] payload:`, masked);
}

/**
 * Sets the refresh token as an HttpOnly cookie (additive hardening).
 * The JSON response body is UNCHANGED so existing localStorage-based
 * clients keep working — browsers simply gain a safer storage option.
 */
function setRefreshCookie(res: Response, refreshToken: string) {
  const isProd = config.nodeEnv === "production";
  const parts = [
    `manara-refresh=${encodeURIComponent(refreshToken)}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${30 * 24 * 60 * 60}`,
  ];
  if (isProd) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function clearRefreshCookie(res: Response) {
  const isProd = config.nodeEnv === "production";
  const cookie = [
    "manara-refresh=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (isProd) cookie.push("Secure");
  // Overwrite with an expired cookie; do not alter JSON contract.
  res.append("Set-Cookie", cookie.join("; "));
}

export const authController = {
  async login(req: Request, res: Response) {
    logAuthPayload("login", req.body);
    const { username, password } = req.body;
    const result = await authService.login(username, password, req.ip);
    setRefreshCookie(res, result.refreshToken);
    return sendSuccess(res, result, "تم تسجيل الدخول بنجاح");
  },

  async logout(req: AuthRequest, res: Response) {
    const token = req.token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : undefined);
    const refreshToken = (req as Request).body?.refreshToken || (req as any).cookies?.["manara-refresh"];
    await authService.logout(token, req.user?.id, req.ip, refreshToken);
    clearRefreshCookie(res);
    return sendSuccess(res, null, "تم تسجيل الخروج بنجاح وإلغاء صلاحية الجلسة");
  },

  async refresh(req: Request, res: Response) {
    const refreshToken = req.body.refreshToken || (req as any).cookies?.["manara-refresh"];
    const result = await authService.refresh(refreshToken);
    setRefreshCookie(res, result.refreshToken);
    return sendSuccess(res, result, "تم تجديد الجلسة بنجاح");
  },

  async me(req: AuthRequest, res: Response) {
    const { password_hash, ...safeUser } = req.user!;
    return sendSuccess(res, safeUser);
  },

  async register(req: Request, res: Response) {
    logAuthPayload("register", req.body);
    const { name, email, phone, password } = req.body;
    const result = await authService.register({ name, email, phone, password });
    setRefreshCookie(res, result.refreshToken);
    return sendSuccess(res, result, "تم إنشاء الحساب بنجاح", 201);
  },

  async changePassword(req: AuthRequest, res: Response) {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.id, currentPassword, newPassword, req.ip);
    return sendSuccess(res, null, "تم تغيير كلمة المرور بنجاح");
  },
};
