import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { AppError, sendError } from "../utils/response.js";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): any => {
  logger.error("Unhandled Error Caught", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // AppError (Known operational error)
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.code, err.details);
  }

  // SQLite Unique Constraint or Foreign key error
  if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return sendError(res, "قيمة مكررة في قاعدة البيانات، يرجى التأكد من عدم تكرار الكود أو البيانات الفريدة", 409, "DUPLICATE_ENTRY");
  }

  if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
    return sendError(res, "عنصر مرتبط ببيانات أخرى لا يمكن حذفه أو ربطه بعنصر غير موجود", 400, "FOREIGN_KEY_VIOLATION");
  }

  if (err.code === "SQLITE_CONSTRAINT_CHECK") {
    return sendError(res, "البيانات لا تطابق الشروط المفروضة على الحقول (مثل الدرجة أو المبلغ)", 400, "CHECK_CONSTRAINT_VIOLATION");
  }

  // Multer Error
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return sendError(res, "حجم الملف يتجاوز الحد المسموح (10MB)", 400, "FILE_TOO_LARGE");
    }
    return sendError(res, `خطأ في رفع الملف: ${err.message}`, 400, "FILE_UPLOAD_ERROR");
  }

  // File type gate from excelRoutes fileFilter
  if (err.message === "FILE_TYPE_NOT_ALLOWED") {
    return sendError(res, "نوع الملف غير مدعوم — المسموح: ملفات Excel بصيغة XLSX أو XLS أو CSV فقط", 400, "FILE_TYPE_NOT_ALLOWED");
  }

  // Generic 500 Internal Server Error (Never expose stack trace)
  return sendError(res, "حدث خطأ غير متوقع في الخادم، تم تسجيل المشكلة", 500, "INTERNAL_SERVER_ERROR");
};
