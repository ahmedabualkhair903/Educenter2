import { backupService } from "../services/backupService.js";
import { logger } from "../utils/logger.js";

async function runManualBackup() {
  console.log("=== Educational Center Management System — Database Backup ===");
  try {
    const backup = await backupService.createBackup("CLI_MANUAL_SCRIPT");
    console.log(`\n✅ Backup Created Successfully!`);
    console.log(`📁 File: ${backup.filename}`);
    console.log(`📦 Size: ${backup.sizeFormatted}`);
    console.log(`📍 Path: ${backup.filepath}`);
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Backup Failed: ${error.message}`);
    process.exit(1);
  }
}

runManualBackup();
