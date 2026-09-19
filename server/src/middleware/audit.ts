import crypto from "node:crypto";
import { getDatabase } from "../database/db.js";
import { logger } from "../utils/logger.js";

export function logAudit(options: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: any;
  newData?: any;
  ip?: string;
}): void {
  try {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    let validUserId: string | null = null;
    let extraMeta = options.newData || {};

    if (options.userId) {
      const userExists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(options.userId);
      if (userExists) {
        validUserId = options.userId;
      } else {
        extraMeta = { ...extraMeta, actor: options.userId };
      }
    }

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_data, new_data, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      validUserId,
      options.action,
      options.entityType,
      options.entityId ?? null,
      options.oldData ? JSON.stringify(options.oldData) : null,
      Object.keys(extraMeta).length > 0 ? JSON.stringify(extraMeta) : null,
      options.ip ?? null,
      now
    );
  } catch (error) {
    logger.error("Failed to record audit log", { error, options });
  }
}
