import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import apiRouter from "./routes/index.js";
import { logger } from "./utils/logger.js";
import { sendError, sendSuccess } from "./utils/response.js";

export const app = express();

// Enable trust proxy for correct IP rate limiting and logging
app.set("trust proxy", 1);

// Security middleware (helmet defaults: HSTS, noSniff, frameguard, XSS filter, etc.)
// Kept as default helmet() so no HTML/API contract changes.
app.use(helmet());

/**
 * Minimal cookie parser (zero new dependencies).
 * Populates req.cookies so existing auth code reading
 * req.cookies["manara-token" | "manara-refresh"] works on Express 4
 * without adding cookie-parser. Read-only, never alters body/query.
 */
function liteCookieParser(req: any, _res: any, next: any) {
  try {
    const header: string | undefined = req.headers?.cookie;
    const cookies: Record<string, string> = {};
    if (header) {
      for (const part of header.split(";")) {
        const idx = part.indexOf("=");
        if (idx > 0) {
          const key = part.slice(0, idx).trim();
          const val = part.slice(idx + 1).trim();
          if (key && cookies[key] === undefined) {
            try {
              cookies[key] = decodeURIComponent(val);
            } catch {
              cookies[key] = val;
            }
          }
        }
      }
    }
    req.cookies = { ...(req.cookies || {}), ...cookies };
  } catch {
    if (!req.cookies) req.cookies = {};
  }
  next();
}

const configuredOrigins = config.corsOrigin === "*"
  ? ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000"]
  : config.corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like server-to-server, desktop apps, or curl)
      if (!origin) return callback(null, true);

      // In development, allow localhost or wildcard if explicitly configured
      if (config.nodeEnv !== "production") {
        if (config.corsOrigin === "*" || configuredOrigins.includes(origin)) {
          return callback(null, true);
        }
      }

      // In production, strictly enforce whitelist and NEVER permit wildcard '*'
      if (config.nodeEnv === "production") {
        const allowedInProd = configuredOrigins.filter((o) => o !== "*");
        if (allowedInProd.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS in production`), false);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-idempotency-key"],
  })
);

// Request parsing - lowered to 5mb for general JSON endpoints
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
// Cookie support for HttpOnly refresh/access tokens (additive, no contract change)
app.use(liteCookieParser);

// Request logging via morgan + winston
app.use(
  morgan("combined", {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
    skip: (req) => req.url === "/health",
  })
);

// Rate limiter on API endpoints
app.use("/api", apiLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
  return sendSuccess(res, {
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  }, "الخادم يعمل بحالة ممتازة");
});

// Root API Router
app.use("/api", apiRouter);

// 404 Handler
app.use((req, res) => {
  return sendError(res, `المسار المطلوب غير موجود: ${req.method} ${req.originalUrl}`, 404, "ROUTE_NOT_FOUND");
});

// Global Error Handler
app.use(errorHandler);
