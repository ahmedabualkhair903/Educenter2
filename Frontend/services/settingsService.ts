import { api } from "@/lib/api";
import type { AppSettings, ParentPortalSettings } from "@/types";

export const settingsService = {
  get: async (): Promise<AppSettings> => {
    const res = await api.get<AppSettings>("/settings");
    return res.data;
  },

  update: async (nextSettings: AppSettings): Promise<AppSettings> => {
    const res = await api.put<AppSettings>("/settings", nextSettings);
    return res.data;
  },

  getRooms: async (): Promise<string[]> => {
    try {
      const res = await api.get<string[]>("/settings/rooms");
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },

  addRoom: async (name: string): Promise<string[]> => {
    const res = await api.post<string[]>("/settings/rooms", { name });
    return res.data;
  },

  getSubjects: async (): Promise<string[]> => {
    try {
      const res = await api.get<string[]>("/settings/subjects");
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },

  addSubject: async (name: string): Promise<string[]> => {
    const res = await api.post<string[]>("/settings/subjects", { name });
    return res.data;
  },

  syncParentPortal: async (
    currentSettings: AppSettings,
  ): Promise<{
    settings: AppSettings;
    success: boolean;
    message: string;
  }> => {
    const currentParentPortal: ParentPortalSettings =
      currentSettings.parentPortal;

    if (!currentParentPortal.enabled) {
      return {
        settings: currentSettings,
        success: false,
        message: "بوابة ولي الأمر غير مفعلة.",
      };
    }

    try {
      const res = await api.post<{ settings: AppSettings; message: string }>(
        "/settings/sync-portal",
        currentSettings,
      );
      return { ...res.data, success: true };
    } catch (err: unknown) {
      return {
        settings: currentSettings,
        success: false,
        message:
          err instanceof Error ? err.message : "فشل في مزامنة بوابة ولي الأمر.",
      };
    }
  },
};
