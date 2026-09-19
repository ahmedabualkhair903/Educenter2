import { getDatabase } from "../database/db.js";
import type { AppSettings } from "../models/index.js";

const DEFAULT_SETTINGS: AppSettings = {
  center: {
    centerName: "سنتر المنارة التعليمي",
    logoUrl: "",
    phone: "01000000000",
    secondaryPhone: "01100000000",
    address: "القاهرة، مصر",
    academicYear: "2025/2026",
    currency: "EGP",
  },
  attendance: {
    enabled: true,
    checkOutEnabled: true,
    locationEnabled: false,
    passwordEnabled: false,
    allowedRadiusMeters: 100,
  },
  notifications: {
    whatsappEnabled: true,
    resultMessagesEnabled: true,
    attendanceMessagesEnabled: true,
    checkOutMessagesEnabled: true,
    absenceMessagesEnabled: true,
  },
  modules: {
    students: true,
    groups: true,
    lessons: true,
    payments: true,
    exams: true,
    excel: true,
    attendance: true,
    checkOut: true,
    location: false,
    attendancePassword: false,
    whatsapp: true,
    resultMessages: true,
    attendanceMessages: true,
    checkOutMessages: true,
    absenceMessages: true,
    reports: true,
  },
  paymentsEnabled: true,
  reportsEnabled: true,
  parentPortal: {
    enabled: false,
    syncMode: "manual",
    lastSync: null,
    syncStatus: "idle",
    pendingSync: 0,
  },
  backupEnabled: true,
};

export const settingsRepository = {
  getAll(): AppSettings {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM settings").all() as any[];

    if (rows.length === 0) {
      // Seed default settings directly without calling saveAll -> getAll
      this.rawSave(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    const settingsObj: any = {};
    for (const row of rows) {
      try {
        settingsObj[row.key] = JSON.parse(row.value);
      } catch {
        settingsObj[row.key] = row.value;
      }
    }

    return {
      ...DEFAULT_SETTINGS,
      ...settingsObj,
      center: { ...DEFAULT_SETTINGS.center, ...settingsObj.center },
      attendance: { ...DEFAULT_SETTINGS.attendance, ...settingsObj.attendance },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...settingsObj.notifications },
      modules: { ...DEFAULT_SETTINGS.modules, ...settingsObj.modules },
      parentPortal: { ...DEFAULT_SETTINGS.parentPortal, ...settingsObj.parentPortal },
    };
  },

  get<T>(key: string, defaultValue: T): T {
    const db = getDatabase();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  },

  set(key: string, value: any): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(key, JSON.stringify(value), now);
  },

  rawSave(settings: AppSettings): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.transaction(() => {
      for (const [k, v] of Object.entries(settings)) {
        db.prepare(`
          INSERT INTO settings (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        `).run(k, JSON.stringify(v), now);
      }
    })();
  },

  saveAll(settings: Partial<AppSettings>): AppSettings {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM settings").all() as any[];
    const settingsObj: any = {};
    for (const row of rows) {
      try {
        settingsObj[row.key] = JSON.parse(row.value);
      } catch {
        settingsObj[row.key] = row.value;
      }
    }

    const current: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...settingsObj,
      center: { ...DEFAULT_SETTINGS.center, ...settingsObj.center },
      attendance: { ...DEFAULT_SETTINGS.attendance, ...settingsObj.attendance },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...settingsObj.notifications },
      modules: { ...DEFAULT_SETTINGS.modules, ...settingsObj.modules },
      parentPortal: { ...DEFAULT_SETTINGS.parentPortal, ...settingsObj.parentPortal },
    };

    const merged: AppSettings = {
      ...current,
      ...settings,
      center: { ...current.center, ...(settings.center || {}) },
      attendance: { ...current.attendance, ...(settings.attendance || {}) },
      notifications: { ...current.notifications, ...(settings.notifications || {}) },
      modules: { ...current.modules, ...(settings.modules || {}) },
      parentPortal: { ...current.parentPortal, ...(settings.parentPortal || {}) },
    };

    this.rawSave(merged);
    return merged;
  },
};
