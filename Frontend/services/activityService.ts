import { api } from "@/lib/api";
import type { StudentActivity } from "@/types";

export const activityService = {
  list: async (params?: {
    limit?: number;
  }): Promise<StudentActivity[]> => {
    const res = await api.get<StudentActivity[]>(
      "/audit-logs",
      params as Record<string, string>,
    );
    return res.data;
  },

  listByStudent: async (studentId: string): Promise<StudentActivity[]> => {
    const res = await api.get<StudentActivity[]>("/audit-logs", { studentId });
    return res.data;
  },

  getById: async (id: string): Promise<StudentActivity | null> => {
    try {
      const res = await api.get<StudentActivity>(`/audit-logs/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  create: async (
    activity: Omit<StudentActivity, "id">,
  ): Promise<StudentActivity> => {
    // Activity logs are created automatically by the backend's audit middleware.
    // This method is kept for frontend compatibility.
    const res = await api.post<StudentActivity>("/audit-logs", activity);
    return res.data;
  },
};
