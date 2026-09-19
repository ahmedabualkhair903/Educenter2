import http from "node:http";
import { app } from "./app.js";
import { config } from "./config/index.js";
import { closeDatabase, getDatabase } from "./database/db.js";
import { backupScheduler } from "./jobs/backupScheduler.js";
import { lessonStatusJob } from "./jobs/lessonStatusJob.js";
import { whatsappWorker } from "./jobs/whatsappWorker.js";
import { logger } from "./utils/logger.js";

async function bootstrap() {
  logger.info("Initializing Educational Center Management System Backend...");

  // Initialize SQLite database
  const db = getDatabase();

  // Start background jobs
  whatsappWorker.start();
  backupScheduler.start();
  lessonStatusJob.start();

  const server = http.createServer(app);

  // Listen on 0.0.0.0 to enable Multi-PC LAN connectivity within the educational center
  server.listen(config.port, "0.0.0.0", () => {
    logger.info(`🚀 Server running in ${config.nodeEnv} mode on http://0.0.0.0:${config.port}`);
    logger.info(`📱 API Base URL: http://localhost:${config.port}/api`);
    logger.info(`🏥 Health Check: http://localhost:${config.port}/health`);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Gracefully shutting down server...");
    whatsappWorker.stop();
    backupScheduler.stop();
    lessonStatusJob.stop();
    server.close(() => {
      closeDatabase();
      logger.info("Server closed successfully.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  logger.error("Failed to start backend server", { error: err.message, stack: err.stack });
  process.exit(1);
});
