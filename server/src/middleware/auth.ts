import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { getDatabase } from "../database/db.js";
import type { Role, User } from "../models/index.js";
import { sendError } from "../utils/response.js";

import { tokenRepository } from "../repositories/tokenRepository.js";

export interface AuthRequest extends Request {
  user?: User;
  token?: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: Role;
  exp?: number;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): any => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies["manara-token"]) {
      token = req.cookies["manara-token"];
    }

    if (!token) {
      return sendError(res, "غير مصرح - يرجى تسجيل الدخول أولاً", 401, "UNAUTHORIZED");
    }

    // Check blacklist
    if (tokenRepository.isRevoked(token)) {
      return sendError(res, "تم تسجيل الخروج وإلغاء هذه الجلسة، يرجى تسجيل الدخول مجددًا", 401, "TOKEN_REVOKED");
    }

    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    const db = getDatabase();
    const userRow = db.prepare(
      "SELECT id, username, name, email, role, is_active, last_login_at, created_at, updated_at FROM users WHERE id = ?"
    ).get(decoded.userId) as User | undefined;

    if (!userRow) {
      return sendError(res, "المستخدم غير موجود", 401, "USER_NOT_FOUND");
    }

    if (!userRow.is_active) {
      return sendError(res, "تم تعطيل هذا الحساب. يرجى مراجعة المسؤول", 403, "ACCOUNT_DISABLED");
    }

    req.user = userRow;
    req.token = token;
    next();
  } catch (error) {
    return sendError(res, "جلسة العمل غير صالحة أو منتهية، يرجى تسجيل الدخول مجددًا", 401, "INVALID_TOKEN");
  }
};
