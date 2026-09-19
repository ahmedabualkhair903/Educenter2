import rateLimit from "express-rate-limit";
import { sendError } from "../utils/response.js";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      "تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة.",
      429,
      "RATE_LIMIT_EXCEEDED"
    );
  },
});

// Registration abuse guard — same budget as login to preserve legit UX
// while blocking enumeration/spam. Additive only, no contract change.
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      "تم تجاوز الحد الأقصى لمحاولات إنشاء الحسابات. يرجى المحاولة بعد 15 دقيقة.",
      429,
      "RATE_LIMIT_EXCEEDED"
    );
  },
});

// Refresh-token guessing guard — generous budget so legit clients never hit it.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      "طلبات كثيرة لتجديد الجلسة. يرجى المحاولة بعد قليل.",
      429,
      "RATE_LIMIT_EXCEEDED"
    );
  },
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600, // 600 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(res, "طلب سريع جدًا، يرجى الانتظار قليلاً", 429, "TOO_MANY_REQUESTS");
  },
});
