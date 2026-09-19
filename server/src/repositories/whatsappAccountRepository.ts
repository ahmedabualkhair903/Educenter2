import { getDatabase } from "../database/db.js";
import type { WhatsAppAccount } from "../models/index.js";

function mapRow(row: any): WhatsAppAccount {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    providerName: row.provider_name,
    apiUrl: row.api_url,
    // Never expose the raw token in list responses; service strips it.
    apiToken: row.api_token,
    isDefault: Boolean(row.is_default),
    status: row.status,
    syncId: row.sync_id || undefined,
    syncStatus: row.sync_status || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const whatsappAccountRepository = {
  listAll(): WhatsAppAccount[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM whatsapp_accounts
      ORDER BY is_default DESC, created_at ASC
    `).all() as any[];
    return rows.map(mapRow);
  },

  findById(id: string): WhatsAppAccount | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM whatsapp_accounts WHERE id = ?
    `).get(id) as any;
    if (!row) return undefined;
    return mapRow(row);
  },

  findDefault(): WhatsAppAccount | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM whatsapp_accounts
      WHERE is_default = 1 AND status = 'active'
      LIMIT 1
    `).get() as any;
    if (!row) return undefined;
    return mapRow(row);
  },

  findOldestActive(excludeId?: string): WhatsAppAccount | undefined {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM whatsapp_accounts
      WHERE status = 'active' AND id != ?
      ORDER BY created_at ASC
      LIMIT 1
    `).get(excludeId ?? "") as any;
    if (!row) return undefined;
    return mapRow(row);
  },

  create(account: {
    id: string;
    phone_number: string;
    provider_name: string;
    api_url: string;
    api_token: string;
    is_default: number;
    status: string;
    sync_id?: string | null;
    created_at: string;
    updated_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO whatsapp_accounts (id, phone_number, provider_name, api_url, api_token, is_default, status, sync_id, created_at, updated_at)
      VALUES (@id, @phone_number, @provider_name, @api_url, @api_token, @is_default, @status, @sync_id, @created_at, @updated_at)
    `).run({
      id: account.id,
      phone_number: account.phone_number,
      provider_name: account.provider_name,
      api_url: account.api_url,
      api_token: account.api_token,
      is_default: account.is_default ? 1 : 0,
      status: account.status,
      sync_id: account.sync_id || null,
      created_at: account.created_at,
      updated_at: account.updated_at,
    });
  },

  update(id: string, updates: Partial<{
    phone_number: string;
    provider_name: string;
    api_url: string;
    api_token: string;
    is_default: number;
    status: string;
  }>): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };

    const allowed = [
      "phone_number",
      "provider_name",
      "api_url",
      "api_token",
      "is_default",
      "status",
    ] as const;
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        sets.push(`${key} = @${key}`);
        params[key] = updates[key];
      }
    }

    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();

    if (sets.length > 0) {
      db.prepare(`UPDATE whatsapp_accounts SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  clearDefaults(): void {
    const db = getDatabase();
    db.prepare(`UPDATE whatsapp_accounts SET is_default = 0, updated_at = ?`).run(
      new Date().toISOString()
    );
  },

  delete(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM whatsapp_accounts WHERE id = ?").run(id);
  },
};
