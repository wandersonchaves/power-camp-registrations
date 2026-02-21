// src/infra/efi/webhooks/efi-webhook.types.ts

/**
 * Request para configuração de webhook Efí Pix
 */
export type EfiWebhookConfigRequest = Readonly<{
  webhookUrl: string;
}>;

/**
 * Response padrão Efí Pix Webhook
 */
export type EfiWebhookConfigResponse = Readonly<{
  webhookUrl: string;

  /** ISO datetime */
  criacao: string;

  /** Compatibilidade futura */
  [k: string]: unknown;
}>;
