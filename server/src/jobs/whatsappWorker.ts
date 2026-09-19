import { config } from "../config/index.js";
import { resolveWhatsAppProvider } from "../providers/whatsapp/index.js";
import type { WhatsAppProvider } from "../providers/whatsapp/WhatsAppProvider.js";
import { notificationRepository } from "../repositories/notificationRepository.js";
import { logger } from "../utils/logger.js";

let isRunning = false;
let intervalTimer: NodeJS.Timeout | null = null;

export const whatsappWorker = {
  start(): void {
    if (intervalTimer) return;

    logger.info(`Starting WhatsApp Queue Worker (Interval: ${config.whatsappWorkerIntervalMs}ms)`);
    intervalTimer = setInterval(async () => {
      await this.processQueue();
    }, config.whatsappWorkerIntervalMs);
  },

  stop(): void {
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
      logger.info("WhatsApp Queue Worker stopped.");
    }
  },

  async processQueue(): Promise<void> {
    if (isRunning) return;
    isRunning = true;

    try {
      const pendingItems = notificationRepository.getPendingQueue(10);
      if (pendingItems.length === 0) {
        isRunning = false;
        return;
      }

      logger.info(`Processing ${pendingItems.length} pending WhatsApp notifications`);

      // المزود الافتراضي يُحل مرة واحدة للدورة — ورسائل الحساب المحدد
      // تستخدم حسابها الخاص (dynamic routing من قاعدة البيانات).
      let cycleDefault: WhatsAppProvider | null = null;

      for (const item of pendingItems) {
        try {
          let provider: WhatsAppProvider;
          if (item.whatsappAccountId) {
            provider = resolveWhatsAppProvider(item.whatsappAccountId);
          } else {
            if (!cycleDefault) {
              cycleDefault = resolveWhatsAppProvider();
            }
            provider = cycleDefault;
          }

          notificationRepository.updateStatus(item.id, "processing");
          const result = await provider.sendMessage(item.recipientPhone, item.message);

          if (result.success) {
            notificationRepository.updateStatus(item.id, "sent");
          } else {
            notificationRepository.updateStatus(item.id, "failed", result.error || "Failed to deliver");
          }
        } catch (itemErr: any) {
          logger.error(`Error sending notification ID ${item.id}`, { error: itemErr.message });
          notificationRepository.updateStatus(item.id, "failed", itemErr.message);
        }
      }
    } catch (err: any) {
      logger.error("Error in WhatsApp worker cycle", { error: err.message });
    } finally {
      isRunning = false;
    }
  },
};
