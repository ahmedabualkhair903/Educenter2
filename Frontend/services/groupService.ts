import { api } from "@/lib/api";
import type { Group } from "@/types";

export type CreateGroupInput = Omit<Group, "id" | "createdAt" | "updatedAt">;
export type UpdateGroupInput = Partial<Omit<Group, "id" | "createdAt">>;

export const groupService = {
  list: async (params?: {
    teacherId?: string;
    subjectId?: string;
    search?: string;
  }): Promise<Group[]> => {
    const res = await api.get<Group[]>("/groups", params as Record<string, string>);
    return res.data;
  },

  getById: async (id: string): Promise<Group | null> => {
    try {
      const res = await api.get<Group>(`/groups/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  create: async (group: CreateGroupInput): Promise<Group> => {
    const res = await api.post<Group>("/groups", group);
    return res.data;
  },

  update: async (
    id: string,
    updates: UpdateGroupInput,
  ): Promise<Group | null> => {
    try {
      const res = await api.put<Group>(`/groups/${id}`, updates);
      return res.data;
    } catch {
      return null;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/groups/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  // Enroll a student in a group
  enrollStudent: async (
    groupId: string,
    studentId: string,
  ): Promise<boolean> => {
    try {
      await api.post(`/groups/${groupId}/enroll`, { studentId });
      return true;
    } catch {
      return false;
    }
  },

  // Remove a student from a group
  unenrollStudent: async (
    groupId: string,
    studentId: string,
  ): Promise<boolean> => {
    try {
      await api.delete(`/groups/${groupId}/enroll/${studentId}`);
      return true;
    } catch {
      return false;
    }
  },
};
