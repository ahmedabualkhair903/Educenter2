import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { logAudit } from "../middleware/audit.js";
import type { Role, User } from "../models/index.js";
import { userRepository } from "../repositories/userRepository.js";
import { tokenRepository } from "../repositories/tokenRepository.js";
import { AppError } from "../utils/response.js";

export const authService = {
  async login(username: string, password: string, ip?: string): Promise<{ token: string; refreshToken: string; user: Omit<User, "password_hash"> }> {
    const identifier = username.trim().toLowerCase();

    let user = userRepository.findByUsername(identifier);
    if (!user && identifier.includes("@")) {
      user = userRepository.findByEmail(identifier);
    }
    if (!user) {
      throw new AppError("اسم المستخدم أو كلمة المرور غير صحيحة", 401, "INVALID_CREDENTIALS");
    }

    if (!user.is_active) {
      throw new AppError("تم تعطيل هذا الحساب. يرجى مراجعة إدارة السنتر", 403, "ACCOUNT_DISABLED");
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError("اسم المستخدم أو كلمة المرور غير صحيحة", 401, "INVALID_CREDENTIALS");
    }

    // Update last login
    const now = new Date().toISOString();
    userRepository.update(user.id, { last_login_at: now });

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    // Refresh token (longer lived — defaults to 30 days via config)
    const refreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshExpiresIn as any }
    );

    logAudit({
      userId: user.id,
      action: "LOGIN",
      entityType: "USER",
      entityId: user.id,
      ip,
    });

    const { password_hash, ...safeUser } = user;
    return {
      token,
      refreshToken,
      user: { ...safeUser, email: safeUser.email ?? "", last_login_at: now },
    };
  },

  async logout(token?: string, userId?: string, ip?: string, refreshToken?: string): Promise<void> {
    if (token) {
      tokenRepository.revoke(token);
    }
    // Revoke the paired refresh token as well so logout fully ends the session.
    // Optional param keeps existing callers working unchanged.
    if (refreshToken) {
      try {
        tokenRepository.revoke(refreshToken);
      } catch {
        // Revocation is best-effort; access-token revocation above is sufficient.
      }
    }
    if (userId) {
      logAudit({
        userId,
        action: "LOGOUT",
        entityType: "USER",
        entityId: userId,
        ip,
      });
    }
  },

  async refresh(refreshToken: string): Promise<{ token: string; refreshToken: string; user: Omit<User, "password_hash"> }> {
    if (!refreshToken) {
      throw new AppError("التوكن المحدث مطلوب", 400, "REFRESH_TOKEN_REQUIRED");
    }

    if (tokenRepository.isRevoked(refreshToken)) {
      throw new AppError("التوكن المحدث ملغى، يرجى تسجيل الدخول مجددًا", 401, "TOKEN_REVOKED");
    }

    let decoded: any;
    try {
      // Prefer the dedicated refresh secret; fall back to the access secret
      // so tokens issued before JWT_REFRESH_SECRET was set keep working.
      try {
        decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
      } catch (fallbackErr) {
        if (config.jwtRefreshSecret !== config.jwtSecret) {
          decoded = jwt.verify(refreshToken, config.jwtSecret);
        } else {
          throw fallbackErr;
        }
      }
    } catch {
      throw new AppError("التوكن المحدث غير صالح أو منتهي", 401, "INVALID_REFRESH_TOKEN");
    }

    if (decoded.type !== "refresh" || !decoded.userId) {
      throw new AppError("نوع التوكن غير صالح لعملية التحديث", 400, "INVALID_TOKEN_TYPE");
    }

    const user = userRepository.findById(decoded.userId);
    if (!user) {
      throw new AppError("المستخدم غير موجود", 401, "USER_NOT_FOUND");
    }

    if (!user.is_active) {
      throw new AppError("تم تعطيل هذا الحساب", 403, "ACCOUNT_DISABLED");
    }

    // Revoke old refresh token (refresh token rotation)
    tokenRepository.revoke(refreshToken);

    const newToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshExpiresIn as any }
    );

    const { password_hash, ...safeUser } = user;
    return {
      token: newToken,
      refreshToken: newRefreshToken,
      user: { ...safeUser, email: safeUser.email ?? "" },
    };
  },

  async changePassword(userId: string, currentPass: string, newPass: string, ip?: string): Promise<void> {
    const user = userRepository.findById(userId);
    if (!user) {
      throw new AppError("المستخدم غير موجود", 404, "USER_NOT_FOUND");
    }

    const isValid = await bcrypt.compare(currentPass, user.password_hash);
    if (!isValid) {
      throw new AppError("كلمة المرور الحالية غير صحيحة", 400, "INVALID_CURRENT_PASSWORD");
    }

    const newHash = await bcrypt.hash(newPass, config.bcryptRounds);
    userRepository.update(userId, { password_hash: newHash });

    logAudit({
      userId,
      action: "CHANGE_PASSWORD",
      entityType: "USER",
      entityId: userId,
      ip,
    });
  },

  async createUser(data: { name: string; username: string; email?: string; password: string; role: Role }, creatorId?: string, ip?: string): Promise<Omit<User, "password_hash">> {
    const existing = userRepository.findByUsername(data.username);
    if (existing) {
      throw new AppError("اسم المستخدم مستخدم بالفعل", 409, "USERNAME_EXISTS");
    }

    const hash = await bcrypt.hash(data.password, config.bcryptRounds);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    userRepository.create({
      id,
      name: data.name.trim(),
      username: data.username.trim(),
      email: data.email?.trim() ?? "",
      password_hash: hash,
      role: data.role,
      is_active: 1,
      sync_id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });

    logAudit({
      userId: creatorId,
      action: "CREATE_USER",
      entityType: "USER",
      entityId: id,
      newData: { name: data.name, username: data.username, role: data.role },
      ip,
    });

    const created = userRepository.findById(id)!;
    const { password_hash, ...safeUser } = created;
    return safeUser;
  },

  async updateUser(id: string, updates: { name?: string; username?: string; role?: Role; isActive?: boolean }, updaterId?: string, ip?: string): Promise<Omit<User, "password_hash">> {
    const user = userRepository.findById(id);
    if (!user) {
      throw new AppError("المستخدم غير موجود", 404, "USER_NOT_FOUND");
    }

    if (updates.username && updates.username.toLowerCase() !== user.username.toLowerCase()) {
      const existing = userRepository.findByUsername(updates.username);
      if (existing && existing.id !== id) {
        throw new AppError("اسم المستخدم مستخدم بالفعل", 409, "USERNAME_EXISTS");
      }
    }

    userRepository.update(id, {
      name: updates.name?.trim(),
      username: updates.username?.trim(),
      role: updates.role,
      is_active: updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : undefined,
    });

    logAudit({
      userId: updaterId,
      action: "UPDATE_USER",
      entityType: "USER",
      entityId: id,
      oldData: { name: user.name, username: user.username, role: user.role, is_active: user.is_active },
      newData: updates,
      ip,
    });

    const updated = userRepository.findById(id)!;
    const { password_hash, ...safeUser } = updated;
    return safeUser;
  },

  async resetPassword(userId: string, newPass: string, adminId?: string, ip?: string): Promise<void> {
    const user = userRepository.findById(userId);
    if (!user) {
      throw new AppError("المستخدم غير موجود", 404, "USER_NOT_FOUND");
    }

    const hash = await bcrypt.hash(newPass, config.bcryptRounds);
    userRepository.update(userId, { password_hash: hash });

    logAudit({
      userId: adminId,
      action: "RESET_PASSWORD_BY_ADMIN",
      entityType: "USER",
      entityId: userId,
      ip,
    });
  },

  async register(data: { name: string; email: string; phone?: string; password: string }): Promise<{ token: string; refreshToken: string; user: Omit<User, "password_hash"> }> {
    if (!config.allowPublicRegistration) {
      throw new AppError("التسجيل العام معطل — يرجى مراجعة الإدارة لإنشاء الحساب", 403, "REGISTRATION_DISABLED");
    }
    const email = data.email.trim().toLowerCase();
    const username = email.split("@")[0];

    // Check both derived username AND email to prevent duplicate accounts
    // (previous code only checked the username prefix, so a@x.com vs a@y.com
    // could collide or bypass). Preserves 409 contract for duplicates.
    const existingByUsername = userRepository.findByUsername(username);
    if (existingByUsername) {
      throw new AppError("البريد الإلكتروني مستخدم بالفعل", 409, "EMAIL_EXISTS");
    }
    const existingByEmail = userRepository.findByEmail(email);
    if (existingByEmail) {
      throw new AppError("البريد الإلكتروني مستخدم بالفعل", 409, "EMAIL_EXISTS");
    }

    const hash = await bcrypt.hash(data.password, config.bcryptRounds);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      userRepository.create({
        id,
        name: data.name.trim(),
        username,
        email,
        password_hash: hash,
        role: "employee",
        is_active: 1,
        sync_id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      console.error("[auth.register] failed to persist new user:", {
        username,
        email,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }

    logAudit({
      userId: id,
      action: "REGISTER",
      entityType: "USER",
      entityId: id,
      newData: { name: data.name, email: data.email },
      ip: undefined,
    });

    const token = jwt.sign(
      { userId: id, username, role: "employee" },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    const refreshToken = jwt.sign(
      { userId: id, type: "refresh" },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshExpiresIn as any }
    );

    const created = userRepository.findById(id)!;
    const { password_hash, ...safeUser } = created;
    return {
      token,
      refreshToken,
      user: { ...safeUser, email: safeUser.email ?? "" },
    };
  },

  listUsers(): Omit<User, "password_hash">[] {
    return userRepository.listAll();
  },
};
