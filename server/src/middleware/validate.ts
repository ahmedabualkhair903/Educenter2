import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodType } from "zod";
import { sendError } from "../utils/response.js";

export const validateBody = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return sendError(res, "خطأ في التحقق من البيانات المدخلة", 422, "VALIDATION_ERROR", issues);
      }
      return sendError(res, "بيانات غير صالحة", 400, "BAD_REQUEST");
    }
  };
};

export const validateQuery = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      req.query = await schema.parseAsync(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return sendError(res, "خطأ في بارامترات البحث أو التصفية", 422, "VALIDATION_ERROR", issues);
      }
      return sendError(res, "بارامترات غير صالحة", 400, "BAD_REQUEST");
    }
  };
};
