import { getDatabase } from "../database/db.js";
import type { User } from "../models/index.js";

export const userRepository = {
  findById(id: string): User | undefined {
    const db = getDatabase();
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
  },

  findByUsername(username: string): User | undefined {
    const db = getDatabase();
    return db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as User | undefined;
  },

  findByEmail(email: string): User | undefined {
    const db = getDatabase();
    return db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as User | undefined;
  },

  listAll(): User[] {
    const db = getDatabase();
    return db.prepare("SELECT id, name, username, email, role, is_active, last_login_at, created_at, updated_at FROM users ORDER BY created_at DESC").all() as User[];
  },

  create(user: {
    id: string;
    name: string;
    username: string;
    email?: string;
    password_hash: string;
    role: string;
    is_active?: number;
    sync_id?: string;
    created_at: string;
    updated_at: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO users (id, name, username, email, password_hash, role, is_active, sync_id, created_at, updated_at)
      VALUES (@id, @name, @username, @email, @password_hash, @role, @is_active, @sync_id, @created_at, @updated_at)
    `).run({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email ?? "",
      password_hash: user.password_hash,
      role: user.role,
      is_active: user.is_active ?? 1,
      sync_id: user.sync_id || null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  },

  update(id: string, updates: Partial<User>): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any = { id };

    if (updates.name !== undefined) {
      sets.push("name = @name");
      params.name = updates.name;
    }
    if (updates.username !== undefined) {
      sets.push("username = @username");
      params.username = updates.username;
    }
    if (updates.password_hash !== undefined) {
      sets.push("password_hash = @password_hash");
      params.password_hash = updates.password_hash;
    }
    if (updates.email !== undefined) {
      sets.push("email = @email");
      params.email = updates.email;
    }
    if (updates.role !== undefined) {
      sets.push("role = @role");
      params.role = updates.role;
    }
    if (updates.is_active !== undefined) {
      sets.push("is_active = @is_active");
      params.is_active = updates.is_active ? 1 : 0;
    }
    if (updates.last_login_at !== undefined) {
      sets.push("last_login_at = @last_login_at");
      params.last_login_at = updates.last_login_at;
    }

    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();

    if (sets.length > 0) {
      db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
  },

  count(): number {
    const db = getDatabase();
    const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    return row.count;
  },
};
