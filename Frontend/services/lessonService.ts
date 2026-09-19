import { api } from "@/lib/api";
import type { Lesson } from "@/types";

export type CreateLessonInput = Omit<Lesson, "id" | "createdAt" | "updatedAt">;

export const lessonService = {
  list: async (params?: {
    groupId?: string;
    page?: number;
    limit?: number;
  }): Promise<Lesson[]> => {
    const res = await api.get<Lesson[]>("/groups/lessons/all", params as Record<string, string>);
    return res.data;
  },

  getById: async (id: string): Promise<Lesson | null> => {
    try {
      const res = await api.get<Lesson>(`/groups/lessons/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  create: async (
    lesson: CreateLessonInput,
  ): Promise<Lesson> => {
    const res = await api.post<Lesson>(
      `/groups/${lesson.groupId}/lessons`,
      lesson,
    );
    return res.data;
  },

  update: async (
    id: string,
    updates: Partial<Omit<Lesson, "id" | "createdAt">>,
  ): Promise<Lesson | null> => {
    try {
      const res = await api.put<Lesson>(`/groups/lessons/${id}`, updates);
      return res.data;
    } catch {
      return null;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/groups/lessons/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  cancelWithAlert: async (
    id: string,
    message?: string,
  ): Promise<{
    lesson: Lesson;
    notifiedCount: number;
  }> => {
    const res = await api.post<{
      lesson: Lesson;
      notifiedCount: number;
    }>(`/groups/lessons/${id}/cancel-alert`, {
      message: message?.trim() || undefined,
    });
    return res.data;
  },
};
