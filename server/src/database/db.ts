import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { SCHEMA_SQL } from "./schema.js";

let dbInstance: Database.Database | null = null;

export function getDatabase(dbPath = config.databasePath): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  logger.info(`Opening database connection at: ${dbPath}`);
  dbInstance = new Database(dbPath, {
    verbose: config.nodeEnv === "development" ? undefined : undefined,
  });

  // Enable WAL mode, foreign keys, and busy timeout for multi-PC LAN concurrency
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.pragma("busy_timeout = 5000");

  initDatabase(dbInstance);

  return dbInstance;
}

export function initDatabase(db: Database.Database): void {
  try {
    db.exec(SCHEMA_SQL);
    runMigrations(db);
    logger.info("Database schema initialized/verified successfully.");
  } catch (error) {
    logger.error("Failed to initialize database schema", { error });
    throw error;
  }
}

/** Safe, idempotent column-level migrations for live databases */
function runMigrations(db: Database.Database): void {
  // Migration 1: Add email column to users if missing
  const usersInfo = db.pragma("table_info(users)") as { name: string }[];
  if (!usersInfo.some((col) => col.name === "email")) {
    db.exec(`ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''`);
    logger.info("Migration: added email column to users table.");
  }

  // Migration 2: Add soft-delete columns to expenses
  const expensesInfo = db.pragma("table_info(expenses)") as { name: string }[];
  if (!expensesInfo.some((col) => col.name === "is_deleted")) {
    db.exec(`ALTER TABLE expenses ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`);
    db.exec(`ALTER TABLE expenses ADD COLUMN deleted_at TEXT`);
    db.exec(`ALTER TABLE expenses ADD COLUMN deleted_by TEXT`);
    logger.info("Migration: added soft-delete columns to expenses table.");
  }

  // Migration 3: Add soft-delete columns to exams
  const examsInfo = db.pragma("table_info(exams)") as { name: string }[];
  if (!examsInfo.some((col) => col.name === "is_deleted")) {
    db.exec(`ALTER TABLE exams ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`);
    db.exec(`ALTER TABLE exams ADD COLUMN deleted_at TEXT`);
    db.exec(`ALTER TABLE exams ADD COLUMN deleted_by TEXT`);
    logger.info("Migration: added soft-delete columns to exams table.");
  }

  // Migration 4: Ensure revoked_tokens table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL
    );
  `);

  // Migration 5: Per-lesson subject/teacher/room columns
  const lessonsInfo = db.pragma("table_info(lessons)") as { name: string }[];
  if (!lessonsInfo.some((col) => col.name === "subject")) {
    db.exec(`ALTER TABLE lessons ADD COLUMN subject TEXT`);
    logger.info("Migration: added subject column to lessons table.");
  }
  if (!lessonsInfo.some((col) => col.name === "teacher_id")) {
    db.exec(`ALTER TABLE lessons ADD COLUMN teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL`);
    logger.info("Migration: added teacher_id column to lessons table.");
  }
  if (!lessonsInfo.some((col) => col.name === "room")) {
    db.exec(`ALTER TABLE lessons ADD COLUMN room TEXT`);
    logger.info("Migration: added room column to lessons table.");
  }

  // Migration 6: Notifications — title column + widened type/status CHECKs
  // (SQLite cannot ALTER CHECK constraints, so rebuild only when needed).
  // Preserves all existing rows; fresh DBs already get the new definition.
  const notifDef = (
    db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'notifications'`).get() as { sql?: string } | undefined
  )?.sql ?? "";
  const needsNotifRebuild = notifDef.includes("CREATE TABLE notifications") && !notifDef.includes("'draft'");
  if (needsNotifRebuild) {
    db.exec(`
      CREATE TABLE notifications_new (
        id TEXT PRIMARY KEY,
        student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
        recipient_phone TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('check_in', 'check_out', 'exam_result', 'fee_reminder', 'payment_receipt', 'absence', 'general', 'individual', 'group', 'notification', 'reminder', 'attendance')),
        title TEXT,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'draft', 'scheduled')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        scheduled_at TEXT NOT NULL,
        sent_at TEXT,
        error TEXT,
        attachment_data TEXT,
        attachment_name TEXT,
        attachment_mime TEXT,
        attachment_size INTEGER,
        sync_id TEXT,
        sync_status TEXT DEFAULT 'local',
        created_at TEXT NOT NULL
      );
      INSERT INTO notifications_new (id, student_id, recipient_phone, type, message, status, retry_count, scheduled_at, sent_at, error, sync_id, sync_status, created_at, title)
        SELECT id, student_id, recipient_phone, type, message, status, retry_count, scheduled_at, sent_at, error, sync_id, sync_status, created_at, NULL
        FROM notifications;
      DROP TABLE notifications;
      ALTER TABLE notifications_new RENAME TO notifications;
      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);
    `);
    logger.info("Migration: rebuilt notifications table with title + widened type/status.");
  }

  // Migration 7: Notifications — attachment columns (pure ADD COLUMN, safe)
  const notifCols = db.pragma("table_info(notifications)") as { name: string }[];
  const notifColNames = new Set(notifCols.map((col) => col.name));
  if (notifColNames.size > 0) {
    const attachmentCols: Array<[string, string]> = [
      ["title", "ALTER TABLE notifications ADD COLUMN title TEXT"],
      ["attachment_data", "ALTER TABLE notifications ADD COLUMN attachment_data TEXT"],
      ["attachment_name", "ALTER TABLE notifications ADD COLUMN attachment_name TEXT"],
      ["attachment_mime", "ALTER TABLE notifications ADD COLUMN attachment_mime TEXT"],
      ["attachment_size", "ALTER TABLE notifications ADD COLUMN attachment_size INTEGER"],
    ];
    for (const [col, sql] of attachmentCols) {
      if (!notifColNames.has(col)) {
        db.exec(sql);
        logger.info(`Migration: added ${col} column to notifications table.`);
      }
    }
  }

  // Migration 8: Guarantee uniqueness of auto-generated student codes.
  // Fresh DBs already get UNIQUE(student_code) + UNIQUE(barcode) from SCHEMA_SQL,
  // but live DBs created by older schema versions may lack the enforcement.
  // A UNIQUE INDEX enforces the same guarantee without rebuilding the table,
  // and acts as the final arbiter for concurrent auto-generation (race conditions).
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_students_student_code ON students(student_code);`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_students_barcode ON students(barcode);`);

  // Migration 9: WhatsApp sender accounts table + per-message account link.
  // Purely additive (CREATE IF NOT EXISTS + ADD COLUMN) — safe for live DBs.
  db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_accounts (
      id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL,
      provider_name TEXT NOT NULL DEFAULT 'custom',
      api_url TEXT NOT NULL,
      api_token TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      sync_id TEXT,
      sync_status TEXT DEFAULT 'local',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_default ON whatsapp_accounts(is_default);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_status ON whatsapp_accounts(status);`);

  const notifCols2 = db.pragma("table_info(notifications)") as { name: string }[];
  if (
    notifCols2.length > 0 &&
    !notifCols2.some((col) => col.name === "whatsapp_account_id")
  ) {
    db.exec(`ALTER TABLE notifications ADD COLUMN whatsapp_account_id TEXT REFERENCES whatsapp_accounts(id) ON DELETE SET NULL`);
    logger.info("Migration: added whatsapp_account_id column to notifications table.");
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
      dbInstance = null;
      logger.info("Database connection closed cleanly.");
    } catch (err) {
      logger.error("Error closing database connection", { error: err });
    }
  }
}
