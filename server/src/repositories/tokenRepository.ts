import { getDatabase } from "../database/db.js";

export const tokenRepository = {
  revoke(token: string, expiresAt?: string): void {
    const db = getDatabase();
    // Default expiration: 30 days from now if not specified
    const exp = expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO revoked_tokens (token, expires_at)
      VALUES (?, ?)
    `).run(token, exp);
  },

  isRevoked(token: string): boolean {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT token FROM revoked_tokens
      WHERE token = ? AND datetime(expires_at) > datetime('now')
    `).get(token);
    return Boolean(row);
  },

  cleanExpired(): void {
    const db = getDatabase();
    db.prepare(`DELETE FROM revoked_tokens WHERE datetime(expires_at) <= datetime('now')`).run();
  },
};
