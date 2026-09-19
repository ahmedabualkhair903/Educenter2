import type { Response, NextFunction } from "express";
import type { Role } from "../models/index.js";
import { sendError } from "../utils/response.js";
import type { AuthRequest } from "./auth.js";

export const requireRoles = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return sendError(res, "غير مصرح", 401, "UNAUTHORIZED");
    }

    const userRole = req.user.role;
    // Admin and Owner have super access
    if (userRole === "admin" || userRole === "owner") {
      return next();
    }

    if (roles.includes(userRole)) {
      return next();
    }

    return sendError(
      res,
      "ليس لديك الصلاحيات الكافية لتنفيذ هذا الإجراء",
      403,
      "FORBIDDEN"
    );
  };
};

export const requireAdmin = requireRoles(["admin", "owner"]);
export const requireEmployeeOrAdmin = requireRoles(["admin", "owner", "employee", "secretary"]);
export const requireFinance = requireRoles(["admin", "owner", "employee"]);
