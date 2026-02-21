export type EfiWebhookConfigRequest = Readonly<{
  webhookUrl: string;
}>;

export type EfiWebhookConfigResponse = Readonly<{
  webhookUrl: string;
  criacao: string; // ISO
}>;
