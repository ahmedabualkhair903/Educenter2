export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  name: string;
  sendMessage(phone: string, message: string): Promise<SendMessageResult>;
  getStatus(): Promise<{ ready: boolean; details?: string }>;
}
