import { api } from "@/lib/api";

export type WhatsAppAccountStatus = "active" | "inactive";

export type WhatsAppAccount = {
  id: string;
  phoneNumber: string;
  providerName: string;
  apiUrl: string;
  apiTokenMasked?: string;
  isDefault: boolean;
  status: WhatsAppAccountStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateWhatsAppAccountInput = {
  phoneNumber: string;
  providerName?: string;
  apiUrl: string;
  apiToken: string;
  isDefault?: boolean;
  status?: WhatsAppAccountStatus;
};

export type WhatsAppTestResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  accountId: string;
  phoneNumber: string;
  providerName: string;
};

export const whatsappAccountService = {
  list: async (): Promise<WhatsAppAccount[]> => {
    const res = await api.get<WhatsAppAccount[]>("/whatsapp/accounts");
    return res.data;
  },

  create: async (
    account: CreateWhatsAppAccountInput,
  ): Promise<WhatsAppAccount> => {
    const res = await api.post<WhatsAppAccount>(
      "/whatsapp/accounts",
      account,
    );
    return res.data;
  },

  update: async (
    id: string,
    updates: Partial<CreateWhatsAppAccountInput>,
  ): Promise<WhatsAppAccount> => {
    const res = await api.put<WhatsAppAccount>(
      `/whatsapp/accounts/${id}`,
      updates,
    );
    return res.data;
  },

  remove: async (id: string): Promise<{ promotedDefaultId?: string }> => {
    const res = await api.delete<{ promotedDefaultId?: string }>(
      `/whatsapp/accounts/${id}`,
    );
    return res.data ?? {};
  },

  setDefault: async (id: string): Promise<WhatsAppAccount> => {
    const res = await api.post<WhatsAppAccount>(
      `/whatsapp/accounts/${id}/set-default`,
    );
    return res.data;
  },

  test: async (
    id: string,
    phone: string,
    message?: string,
  ): Promise<WhatsAppTestResult> => {
    const res = await api.post<WhatsAppTestResult>(
      `/whatsapp/accounts/${id}/test`,
      { phone, message: message?.trim() || undefined },
    );
    return res.data;
  },
};
