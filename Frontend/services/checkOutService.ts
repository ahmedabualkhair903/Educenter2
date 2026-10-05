import { api } from "@/lib/api";
import type { CheckOutRecord } from "@/types";

export const checkOutService = {
  list: async (params?: {
    groupId?: string;
    studentId?: string;
    date?: string;
  }): Promise<CheckOutRecord[]> => {
    // Check-out is part of attendance records — query attendance with checkedOutAt
    const res = await api.get<CheckOutRecord[]>(
      "/attendance/checkouts",
      params as Record<string, string>,
    );
    return res.data;
  },

  getById: async (id: string): Promise<CheckOutRecord | null> => {
    try {
      const res = await api.get<CheckOutRecord>(`/attendance/checkouts/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  listByStudent: async (studentId: string): Promise<CheckOutRecord[]> => {
    const res = await api.get<CheckOutRecord[]>("/attendance/checkouts", {
      studentId,
    });
    return res.data;
  },

  listByGroup: async (groupId: string): Promise<CheckOutRecord[]> => {
    const res = await api.get<CheckOutRecord[]>("/attendance/checkouts", {
      groupId,
    });
    return res.data;
  },

  create: async (
    record: Omit<CheckOutRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<CheckOutRecord> => {
    const targetId =
      record.attendanceRecordId ??
      ("id" in record && typeof record.id === "string" ? record.id : undefined) ??
      record.studentId;
    const res = await api.post<CheckOutRecord>(
      `/attendance/${targetId}/checkout`,
      record,
    );
    return res.data;
  },

  update: async (
    id: string,
    updates: Partial<Omit<CheckOutRecord, "id" | "createdAt">>,
  ): Promise<CheckOutRecord | null> => {
    try {
      const res = await api.patch<CheckOutRecord>(
        `/attendance/checkouts/${id}`,
        updates,
      );
      return res.data;
    } catch {
      return null;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/attendance/checkouts/${id}`);
      return true;
    } catch {
      return false;
    }
  },
};
