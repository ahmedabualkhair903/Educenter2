import { config } from "../../config/index.js";
import { whatsappAccountRepository } from "../../repositories/whatsappAccountRepository.js";
import { logger } from "../../utils/logger.js";
import type { SendMessageResult, WhatsAppProvider } from "./WhatsAppProvider.js";

export class MockWhatsAppProvider implements WhatsAppProvider {
  public name = "Mock/Console WhatsApp Gateway";

  async sendMessage(phone: string, message: string): Promise<SendMessageResult> {
    // Clean and validate Egyptian / international phone
    const cleanedPhone = phone.replace(/[^0-9+]/g, "");

    if (!cleanedPhone || cleanedPhone.length < 9) {
      return {
        success: false,
        error: `Invalid recipient phone number: ${phone}`,
      };
    }

    logger.info(`[WhatsApp Dispatch] To: ${cleanedPhone} | Message: "${message}"`);

    // Simulate async network dispatch
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }

  async getStatus(): Promise<{ ready: boolean; details?: string }> {
    return {
      ready: true,
      details: "Mock provider is active and logging messages safely.",
    };
  }
}

/**
 * Real HTTP WhatsApp gateway (Twilio-compatible / generic providers
 * such as UltraMsg, WATI, 360dialog exposing an HTTP send endpoint).
 *
 * Only used when WHATSAPP_PROVIDER=http AND WHATSAPP_API_URL is set;
 * otherwise the factory below keeps the safe Mock provider.
 * Any transport failure resolves to { success: false } — never throws —
 * so the worker marks the row failed instead of crashing.
 */
export class HttpWhatsAppProvider implements WhatsAppProvider {
  public name = "HTTP WhatsApp Gateway";

  private readonly apiUrl: string;
  private readonly apiToken: string;
  private readonly timeoutMs: number;

  constructor(overrides?: {
    apiUrl?: string;
    apiToken?: string;
    timeoutMs?: number;
    name?: string;
  }) {
    this.apiUrl = overrides?.apiUrl ?? config.whatsappApiUrl;
    this.apiToken = overrides?.apiToken ?? config.whatsappApiToken;
    this.timeoutMs = overrides?.timeoutMs ?? config.whatsappTimeoutMs;
    if (overrides?.name) this.name = overrides.name;
  }

  async sendMessage(phone: string, message: string): Promise<SendMessageResult> {
    const cleanedPhone = phone.replace(/[^0-9+]/g, "");

    if (!cleanedPhone || cleanedPhone.length < 9) {
      return {
        success: false,
        error: `Invalid recipient phone number: ${phone}`,
      };
    }

    if (!this.apiUrl) {
      return {
        success: false,
        error: "WHATSAPP_API_URL is not configured",
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );

    try {
      // متوافق مع UltraMsg (token/to/body) والبوابات العامة (to/message + Bearer)
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiToken
            ? { Authorization: `Bearer ${this.apiToken}` }
            : {}),
        },
        body: JSON.stringify({
          to: cleanedPhone,
          body: message,
          message,
          ...(this.apiToken ? { token: this.apiToken } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          success: false,
          error: `Gateway HTTP ${response.status}: ${text.slice(0, 200)}`,
        };
      }

      const payload = (await response.json().catch(() => null)) as {
        messageId?: string;
        id?: string;
        sid?: string;
      } | null;

      return {
        success: true,
        messageId:
          payload?.messageId || payload?.id || payload?.sid || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? `Gateway transport error: ${error.message}`
            : "Gateway transport error",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async getStatus(): Promise<{ ready: boolean; details?: string }> {
    if (!this.apiUrl) {
      return {
        ready: false,
        details: "WHATSAPP_API_URL is not configured.",
      };
    }
    return {
      ready: true,
      details: `HTTP gateway configured at ${this.apiUrl}`,
    };
  }
}

function createDefaultProvider(): WhatsAppProvider {
  if (
    config.whatsappProvider.toLowerCase() === "http" &&
    config.whatsappApiUrl
  ) {
    logger.info(
      `WhatsApp provider: HTTP gateway (${config.whatsappApiUrl})`
    );
    return new HttpWhatsAppProvider();
  }

  if (config.whatsappProvider.toLowerCase() !== "mock") {
    logger.warn(
      `Unknown WHATSAPP_PROVIDER="${config.whatsappProvider}" — falling back to Mock provider.`
    );
  }

  return new MockWhatsAppProvider();
}

export const defaultWhatsAppProvider: WhatsAppProvider =
  createDefaultProvider();

/**
 * Dynamic sender resolution (DB-managed accounts):
 * - accountId given → that account (must exist and be active, else throws).
 * - otherwise the active default account from whatsapp_accounts.
 * - fallback: the .env-configured provider (http or mock).
 */
export function resolveWhatsAppProvider(accountId?: string | null): WhatsAppProvider {
  const clean = typeof accountId === "string" ? accountId.trim() : "";

  if (clean) {
    const account = whatsappAccountRepository.findById(clean);
    if (!account) {
      throw new Error(`WhatsApp account not found: ${clean}`);
    }
    if (account.status !== "active") {
      throw new Error(`WhatsApp account is inactive: ${account.phoneNumber}`);
    }
    return new HttpWhatsAppProvider({
      apiUrl: account.apiUrl,
      apiToken: account.apiToken,
      name: `HTTP WhatsApp Gateway (${account.providerName} / ${account.phoneNumber})`,
    });
  }

  const fallback = whatsappAccountRepository.findDefault();
  if (fallback) {
    return new HttpWhatsAppProvider({
      apiUrl: fallback.apiUrl,
      apiToken: fallback.apiToken,
      name: `HTTP WhatsApp Gateway (${fallback.providerName} / ${fallback.phoneNumber})`,
    });
  }

  return defaultWhatsAppProvider;
}
