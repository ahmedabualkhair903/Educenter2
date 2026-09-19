import cron from "node-cron";
import { lessonRepository } from "../repositories/lessonRepository.js";
import { logger } from "../utils/logger.js";

let cronTask: cron.ScheduledTask | null = null;
let isRunning = false;

export const lessonStatusJob = {
  start(): void {
    if (cronTask) return;

    logger.info("Starting Lesson Status Job (Cron: every minute)");

    cronTask = cron.schedule("* * * * *", async () => {
      if (isRunning) return;
      isRunning = true;

      try {
        const { ongoing, completed } =
          lessonRepository.refreshStatuses();

        if (ongoing > 0 || completed > 0) {
          logger.info(
            `Lesson statuses refreshed: ${ongoing} ongoing, ${completed} completed`
          );
        }
      } catch (error: any) {
        logger.error("Lesson status refresh failed", {
          error: error.message,
        });
      } finally {
        isRunning = false;
      }
    });
  },

  stop(): void {
    if (cronTask) {
      cronTask.stop();
      cronTask = null;
      logger.info("Lesson Status Job stopped.");
    }
  },
};
