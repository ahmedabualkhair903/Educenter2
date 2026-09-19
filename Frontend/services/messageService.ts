import { api } from "@/lib/api";
import type { MessageAttachment, WhatsAppMessage } from "@/types";

export type RecipientType = "student" | "groups";

export type CreateBroadcastInput = {
  title: string;
  message: string;
  type: string;
  status: string;
  recipientType: RecipientType;
  studentId?: string;
  groupIds?: string[];
  scheduledDate?: string;
  scheduledTime?: string;
  attachment?: MessageAttachment | null;
  accountId?: string | null;
};

export type BroadcastResult = {
  notifications: WhatsAppMessage[];
  queuedCount: number;
  skipped: { id: string; reason: string }[];
};

export const messageService = {
  list: async (params?: {
    status?: string;
    studentId?: string;
    page?: number;
    limit?: number;
  }): Promise<WhatsAppMessage[]> => {
    const res = await api.get<WhatsAppMessage[]>(
      "/notifications",
      params as Record<string, string>,
    );
    return res.data;
  },

  listByStudent: async (studentId: string): Promise<WhatsAppMessage[]> => {
    const res = await api.get<WhatsAppMessage[]>("/notifications", {
      studentId,
    });
    return res.data;
  },

  getById: async (id: string): Promise<WhatsAppMessage | null> => {
    try {
      const res = await api.get<WhatsAppMessage>(`/notifications/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  create: async (
    message: Omit<WhatsAppMessage, "id" | "createdAt"> | CreateBroadcastInput,
  ): Promise<WhatsAppMessage | BroadcastResult> => {
    const res = await api.post<WhatsAppMessage | BroadcastResult>(
      "/notifications",
      message,
    );
    return res.data;
  },

  update: async (
    id: string,
    updates: Partial<WhatsAppMessage>,
  ): Promise<WhatsAppMessage | null> => {
    try {
      const res = await api.put<WhatsAppMessage>(
        `/notifications/${id}`,
        updates,
      );
      return res.data;
    } catch {
      return null;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/notifications/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  // Queue a WhatsApp message for sending
  send: async (
    phone: string,
    body: string,
    studentId?: string,
  ): Promise<WhatsAppMessage> => {
    const res = await api.post<WhatsAppMessage>("/notifications", {
      phone,
      body,
      studentId: studentId ?? null,
      type: "custom",
      status: "queued",
    });
    return res.data;
  },
};
