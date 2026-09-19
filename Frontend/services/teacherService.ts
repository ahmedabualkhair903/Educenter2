import { api } from "@/lib/api";
import type { Teacher } from "@/types";

export type CreateTeacherInput = Omit<Teacher, "id" | "createdAt" | "updatedAt">;
export type UpdateTeacherInput = Partial<Omit<Teacher, "id" | "createdAt">>;

export const teacherService = {
  list: async (): Promise<Teacher[]> => {
    const res = await api.get<Teacher[]>("/teachers");
    return res.data;
  },

  getById: async (id: string): Promise<Teacher | null> => {
    try {
      const res = await api.get<Teacher>(`/teachers/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  getStats: async (id: string) => {
    const res = await api.get<{ teacher: Teacher }>(
      `/teachers/${id}/stats`,
    );
    return res.data;
  },

  create: async (teacher: CreateTeacherInput): Promise<Teacher> => {
    const res = await api.post<Teacher>("/teachers", teacher);
    return res.data;
  },

  update: async (
    id: string,
    updates: UpdateTeacherInput,
  ): Promise<Teacher | null> => {
    try {
      const res = await api.put<Teacher>(`/teachers/${id}`, updates);
      return res.data;
    } catch {
      return null;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/teachers/${id}`);
      return true;
    } catch {
      return false;
    }
  },
};