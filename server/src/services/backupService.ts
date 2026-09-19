import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config/index.js";
import { closeDatabase, getDatabase } from "../database/db.js";
import { logAudit } from "../middleware/audit.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/response.js";

export interface BackupInfo {
  filename: string;
  filepath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  isValid: boolean;
}

export const backupService = {
  getBackupDirectory(): string {
    const dir = config.backupPath;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  },

  async createBackup(initiatedBy?: string, ip?: string): Promise<BackupInfo> {
    const db = getDatabase();
    const backupDir = this.getBackupDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `educenter_backup_${timestamp}.db`;
    const targetPath = path.join(backupDir, filename);

    logger.info(`Starting online database backup to: ${targetPath}`);

    try {
      // Execute non-blocking SQLite online backup
      await db.backup(targetPath);
      logger.info(`Backup completed successfully: ${filename}`);

      // Verify backup integrity
      const isValid = this.verifyBackupIntegrity(targetPath);
      if (!isValid) {
        fs.unlinkSync(targetPath);
        throw new AppError("فشل التحقق من سلامة النسخة الاحتياطية", 500, "BACKUP_INTEGRITY_FAILED");
      }

      // Prune old backups to keep last 30
      this.pruneOldBackups(30);

      logAudit({
        userId: initiatedBy,
        action: "CREATE_BACKUP",
        entityType: "BACKUP",
        newData: { filename },
        ip,
      });

      const stats = fs.statSync(targetPath);
      return {
        filename,
        filepath: targetPath,
        sizeBytes: stats.size,
        sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        createdAt: new Date().toISOString(),
        isValid: true,
      };
    } catch (error: any) {
      logger.error("Failed to create database backup", { error: error.message });
      throw new AppError(`فشل إنشاء النسخة الاحتياطية: ${error.message}`, 500, "BACKUP_FAILED");
    }
  },

  listBackups(): BackupInfo[] {
    const backupDir = this.getBackupDirectory();
    if (!fs.existsSync(backupDir)) return [];

    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".db"));
    const results: BackupInfo[] = [];

    for (const filename of files) {
      const filepath = path.join(backupDir, filename);
      try {
        const stats = fs.statSync(filepath);
        results.push({
          filename,
          filepath,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          createdAt: stats.birthtime.toISOString(),
          isValid: true,
        });
      } catch (err) {
        logger.error(`Error reading backup stats for ${filename}`, { error: err });
      }
    }

    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  restoreBackup(filename: string, restoredBy?: string, ip?: string): boolean {
    const backupDir = this.getBackupDirectory();
    const sourcePath = path.join(backupDir, path.basename(filename));

    if (!fs.existsSync(sourcePath)) {
      throw new AppError("ملف النسخة الاحتياطية غير موجود", 404, "BACKUP_FILE_NOT_FOUND");
    }

    // Verify snapshot integrity before restore
    const isValid = this.verifyBackupIntegrity(sourcePath);
    if (!isValid) {
      throw new AppError("ملف النسخة الاحتياطية تالف أو غير صالح للاستعادة", 400, "INVALID_BACKUP_FILE");
    }

    try {
      logger.warn(`Restoring database from: ${filename}`);

      // Graceful draining: force WAL checkpoint before closing active connection
      try {
        const db = getDatabase();
        db.pragma("wal_checkpoint(TRUNCATE)");
      } catch (err: any) {
        logger.warn("WAL checkpoint before restore encountered warning", { error: err.message });
      }

      // Close current active connection
      closeDatabase();

      // Copy snapshot over current active database path
      fs.copyFileSync(sourcePath, config.databasePath);

      // Re-open DB
      getDatabase();

      logAudit({
        userId: restoredBy,
        action: "RESTORE_BACKUP",
        entityType: "BACKUP",
        newData: { filename },
        ip,
      });

      logger.info(`Database restored successfully from: ${filename}`);
      return true;
    } catch (error: any) {
      logger.error("Failed to restore backup", { error: error.message });
      throw new AppError(`فشل استعادة النسخة الاحتياطية: ${error.message}`, 500, "RESTORE_FAILED");
    }
  },

  verifyBackupIntegrity(filePath: string): boolean {
    try {
      const testDb = new Database(filePath, { readonly: true });
      const result = testDb.pragma("integrity_check") as any[];
      testDb.close();
      return Array.isArray(result) && result.length > 0 && result[0].integrity_check === "ok";
    } catch (error) {
      logger.error(`Integrity check failed for: ${filePath}`, { error });
      return false;
    }
  },

  pruneOldBackups(maxKeep = 30): void {
    try {
      const backups = this.listBackups();
      if (backups.length > maxKeep) {
        const toDelete = backups.slice(maxKeep);
        for (const item of toDelete) {
          if (fs.existsSync(item.filepath)) {
            fs.unlinkSync(item.filepath);
            logger.info(`Pruned old backup: ${item.filename}`);
          }
        }
      }
    } catch (error) {
      logger.error("Error while pruning old backups", { error });
    }
  },
};
