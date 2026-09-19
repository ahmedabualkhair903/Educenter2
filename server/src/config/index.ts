import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number.parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "educenter_default_dev_secret_key_2026",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  // Separate refresh secret (falls back to JWT_SECRET so existing tokens keep working).
  // Set JWT_REFRESH_SECRET in production for defense-in-depth.
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "educenter_default_dev_secret_key_2026",
  databasePath: process.env.DATABASE_PATH
    ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
    : path.resolve(process.cwd(), "data", "educenter.db"),
  backupPath: process.env.BACKUP_PATH
    ? path.resolve(process.cwd(), process.env.BACKUP_PATH)
    : path.resolve(process.cwd(), "backups"),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  logLevel: process.env.LOG_LEVEL || "info",
  backupSchedule: process.env.BACKUP_SCHEDULE || "0 3 * * *",
  whatsappWorkerIntervalMs: Number.parseInt(
    process.env.WHATSAPP_WORKER_INTERVAL_MS || "10000",
    10
  ),
  // WhatsApp provider selection: "mock" (default, simulation + logs only)
  // or "http" (real gateway). Real sending requires the variables below.
  whatsappProvider: process.env.WHATSAPP_PROVIDER || "mock",
  whatsappApiUrl: process.env.WHATSAPP_API_URL || "",
  whatsappApiToken: process.env.WHATSAPP_API_TOKEN || "",
  whatsappTimeoutMs: Number.parseInt(
    process.env.WHATSAPP_TIMEOUT_MS || "15000",
    10
  ),
  // Bcrypt cost factor for NEW password hashes. Verification of existing
  // hashes (rounds 10) keeps working — this only affects newly created hashes.
  bcryptRounds: Number.parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
  // Public self-registration switch. Defaults to true to preserve current
  // behavior. Set ALLOW_PUBLIC_REGISTRATION=false to require admin-created users.
  allowPublicRegistration: process.env.ALLOW_PUBLIC_REGISTRATION !== "false",
};

if (config.nodeEnv === "production") {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "educenter_default_dev_secret_key_2026") {
    throw new Error("CRITICAL SECURITY ERROR: JWT_SECRET must be set to a secure unique secret in production environment");
  }
  if (!Number.isInteger(config.bcryptRounds) || config.bcryptRounds < 10 || config.bcryptRounds > 15) {
    throw new Error("CRITICAL SECURITY ERROR: BCRYPT_ROUNDS must be an integer between 10 and 15 in production");
  }
}

