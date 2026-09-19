import crypto from "node:crypto";
import { getDatabase } from "../database/db.js";
import { logAudit } from "../middleware/audit.js";
import type { WhatsAppAccount } from "../models/index.js";
import { whatsappAccountRepository } from "../repositories/whatsappAccountRepository.js";
import { AppError } from "../utils/response.js";
import { HttpWhatsAppProvider } from "../providers/whatsapp/index.js";

/** إخفاء التوكن عند الإرجاع للقوائم — يُعرض مذيل فقط */
function maskToken(token: string): string {
  if (!token) return "";
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function sanitize(account: WhatsAppAccount) {
  return {
    ...account,
    apiToken: undefined,
    apiTokenMasked: maskToken(account.apiToken),
  };
}

export const whatsappAccountService = {
  listAll() {
    return whatsappAccountRepository.listAll().map(sanitize);
  },

  getById(id: string) {
    const account = whatsappAccountRepository.findById(id);
    if (!account) {
      throw new AppError("حساب الواتساب غير موجود", 404, "WHATSAPP_ACCOUNT_NOT_FOUND");
    }
    return sanitize(account);
  },

  getDefault(): WhatsAppAccount | undefined {
    return whatsappAccountRepository.findDefault();
  },

  create(data: {
    phoneNumber: string;
    providerName?: string;
    apiUrl: string;
    apiToken: string;
    isDefault?: boolean;
    status?: "active" | "inactive";
  }, creatorId?: string, ip?: string) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = getDatabase();

    db.transaction(() => {
      if (data.isDefault) {
        whatsappAccountRepository.clearDefaults();
      }
      whatsappAccountRepository.create({
        id,
        phone_number: data.phoneNumber.trim(),
        provider_name: data.providerName?.trim() || "custom",
        api_url: data.apiUrl.trim(),
        api_token: data.apiToken,
        is_default: data.isDefault ? 1 : 0,
        status: data.status || "active",
        sync_id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      });
    })();

    logAudit({
      userId: creatorId,
      action: "CREATE_WHATSAPP_ACCOUNT",
      entityType: "WHATSAPP_ACCOUNT",
      entityId: id,
      newData: { phoneNumber: data.phoneNumber, providerName: data.providerName },
      ip,
    });

    return this.getById(id);
  },

  update(id: string, updates: {
    phoneNumber?: string;
    providerName?: string;
    apiUrl?: string;
    apiToken?: string;
    isDefault?: boolean;
    status?: "active" | "inactive";
  }, updaterId?: string, ip?: string) {
    const existing = whatsappAccountRepository.findById(id);
    if (!existing) {
      throw new AppError("حساب الواتساب غير موجود", 404, "WHATSAPP_ACCOUNT_NOT_FOUND");
    }

    const db = getDatabase();
    db.transaction(() => {
      if (updates.isDefault) {
        whatsappAccountRepository.clearDefaults();
      }
      const payload: any = {};
      if (updates.phoneNumber !== undefined) payload.phone_number = updates.phoneNumber.trim();
      if (updates.providerName !== undefined) payload.provider_name = updates.providerName.trim() || "custom";
      if (updates.apiUrl !== undefined) payload.api_url = updates.apiUrl.trim();
      if (updates.apiToken !== undefined) payload.api_token = updates.apiToken;
      if (updates.isDefault !== undefined) payload.is_default = updates.isDefault ? 1 : 0;
      if (updates.status !== undefined) payload.status = updates.status;
      whatsappAccountRepository.update(id, payload);
    })();

    logAudit({
      userId: updaterId,
      action: "UPDATE_WHATSAPP_ACCOUNT",
      entityType: "WHATSAPP_ACCOUNT",
      entityId: id,
      oldData: { phoneNumber: existing.phoneNumber, status: existing.status },
      newData: updates,
      ip,
    });

    return this.getById(id);
  },

  delete(id: string, deleterId?: string, ip?: string) {
    const existing = whatsappAccountRepository.findById(id);
    if (!existing) {
      throw new AppError("حساب الواتساب غير موجود", 404, "WHATSAPP_ACCOUNT_NOT_FOUND");
    }

    const db = getDatabase();
    let promoted: WhatsAppAccount | undefined;
    db.transaction(() => {
      whatsappAccountRepository.delete(id);
      // إن كان المحذوف هو الافتراضي، رقِّ أقدم حساب نشط تلقائياً
      // حتى لا يتوقف الإرسال بصمت.
      if (existing.isDefault) {
        promoted = whatsappAccountRepository.findOldestActive(id);
        if (promoted) {
          whatsappAccountRepository.clearDefaults();
          whatsappAccountRepository.update(promoted.id, { is_default: 1 });
          promoted = { ...promoted, isDefault: true };
        }
      }
    })();

    logAudit({
      userId: deleterId,
      action: "DELETE_WHATSAPP_ACCOUNT",
      entityType: "WHATSAPP_ACCOUNT",
      entityId: id,
      oldData: { phoneNumber: existing.phoneNumber },
      ip,
    });

    return { deleted: true, promotedDefaultId: promoted?.id };
  },

  setDefault(id: string, setterId?: string, ip?: string) {
    const existing = whatsappAccountRepository.findById(id);
    if (!existing) {
      throw new AppError("حساب الواتساب غير موجود", 404, "WHATSAPP_ACCOUNT_NOT_FOUND");
    }
    if (existing.status !== "active") {
      throw new AppError("لا يمكن تعيين حساب غير نشط كافتراضي", 400, "ACCOUNT_INACTIVE");
    }

    const db = getDatabase();
    db.transaction(() => {
      whatsappAccountRepository.clearDefaults();
      whatsappAccountRepository.update(id, { is_default: 1 });
    })();

    logAudit({
      userId: setterId,
      action: "SET_DEFAULT_WHATSAPP_ACCOUNT",
      entityType: "WHATSAPP_ACCOUNT",
      entityId: id,
      newData: { phoneNumber: existing.phoneNumber },
      ip,
    });

    return this.getById(id);
  },

  async testAccount(id: string, phone: string, message?: string) {
    const account = whatsappAccountRepository.findById(id);
    if (!account) {
      throw new AppError("حساب الواتساب غير موجود", 404, "WHATSAPP_ACCOUNT_NOT_FOUND");
    }
    if (account.status !== "active") {
      throw new AppError("الحساب غير نشط", 400, "ACCOUNT_INACTIVE");
    }

    const provider = new HttpWhatsAppProvider({
      apiUrl: account.apiUrl,
      apiToken: account.apiToken,
      name: `HTTP WhatsApp Gateway (${account.providerName})`,
    });
    const result = await provider.sendMessage(
      phone,
      message?.trim() || "رسالة اختبار من نظام إدارة المركز ✔"
    );
    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      accountId: account.id,
      phoneNumber: account.phoneNumber,
      providerName: account.providerName,
    };
  },
};
