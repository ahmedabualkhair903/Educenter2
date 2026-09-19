import cron from "node-cron";
import { config } from "../config/index.js";
import { settingsRepository } from "../repositories/settingsRepository.js";
import { backupService } from "../services/backupService.js";
import { logger } from "../utils/logger.js";

let cronTask: cron.ScheduledTask | null = null;

export const backupScheduler = {
  start(): void {
    if (cronTask) return;

    logger.info(`Starting Automated DB Backup Scheduler (Cron: ${config.backupSchedule})`);

    cronTask = cron.schedule(config.backupSchedule, async () => {
      const settings = settingsRepository.getAll();
      if (!settings.backupEnabled) {
        logger.info("Automated backup skipped (disabled in settings)");
        return;
      }

      logger.info("Running scheduled daily database backup...");
      try {
        const backupInfo = await backupService.createBackup("SYSTEM_SCHEDULER");
        logger.info(`Scheduled backup created successfully: ${backupInfo.filename} (${backupInfo.sizeFormatted})`);
      } catch (error: any) {
        logger.error("Scheduled backup failed", { error: error.message });
      }
    });
  },

  stop(): void {
    if (cronTask) {
      cronTask.stop();
      cronTask = null;
      logger.info("Backup scheduler stopped.");
    }
  },
};
