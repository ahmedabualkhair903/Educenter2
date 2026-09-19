import { getDatabase } from "../database/db.js";
import type { AuditLog } from "../models/index.js";

export const auditLogRepository = {
  list(filters?: { userId?: string; entityType?: string; entityId?: string; limit?: number }): AuditLog[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters?.userId) {
      conditions.push("a.user_id = ?");
      values.push(filters.userId);
    }
    if (filters?.entityType) {
      conditions.push("a.entity_type = ?");
      values.push(filters.entityType);
    }
    if (filters?.entityId) {
      conditions.push("a.entity_id = ?");
      values.push(filters.entityId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    // Parameterized LIMIT with sane clamp (previously string-interpolated).
    // Invalid limits fall back to 100 (previous default).
    const parsedLimit = filters?.limit ? Number(filters.limit) : undefined;
    const limitValue =
      parsedLimit !== undefined && Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(1000, Math.floor(parsedLimit)))
        : 100;
    values.push(limitValue);

    const rows = db.prepare(`
      SELECT a.*, u.name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(...values) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id || undefined,
      userName: r.user_name || undefined,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id || undefined,
      oldData: r.old_data ? JSON.parse(r.old_data) : undefined,
      newData: r.new_data ? JSON.parse(r.new_data) : undefined,
      ip: r.ip || undefined,
      createdAt: r.created_at,
    }));
  },
};
