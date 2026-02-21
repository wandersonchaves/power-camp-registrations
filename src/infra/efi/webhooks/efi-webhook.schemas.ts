import { z } from "zod";

/**
 * Statuses possíveis variam por PSP/versão. Mantemos enum “aberta”:
 * - validamos que é string
 * - e normalizamos para decidir se “é pago”
 */
export const EfiWebhookBaseSchema = z
  .object({
    txid: z
      .string()
      .min(26)
      .max(35)
      .regex(/^[a-zA-Z0-9]{26,35}$/),
    status: z.string().min(1),
    // alguns PSPs enviam timestamp com nomes diferentes
    paidAt: z.string().datetime().optional(),
    horario: z.string().datetime().optional(),
    dataLiquidacao: z.string().optional(), // às vezes vem YYYY-MM-DD
  })
  .strict();

export type EfiWebhookBase = z.infer<typeof EfiWebhookBaseSchema>;

/**
 * Payload de teste disparado quando cadastra o webhook.
 * A doc diz que envia notificação de teste. Normalmente vem algo simples.
 * Se não tiver txid/status, tratamos como "ignored".
 */
export const EfiWebhookTestSchema = z
  .object({
    // campos variam muito; aceitamos apenas algo que identifique “teste”
    webhookUrl: z.string().url().optional(),
    criacao: z.string().datetime().optional(),
    teste: z.boolean().optional(),
    message: z.string().optional(),
  })
  .strict();

export type EfiWebhookTest = z.infer<typeof EfiWebhookTestSchema>;

export type PaymentWebhookEvent = Readonly<{
  txid: string;
  status: string;
  isPaid: boolean;
  paidAt: Date;
}>;

export function normalizePaymentEvent(
  input: EfiWebhookBase,
): PaymentWebhookEvent {
  const status = input.status.trim();

  const upper = status.toUpperCase();

  const isPaid =
    upper.includes("LIQ") ||
    upper.includes("CONCL") ||
    upper.includes("PAGA") ||
    upper.includes("PAID");

  // prioridade: paidAt ISO -> horario ISO -> dataLiquidacao (YYYY-MM-DD) -> now
  const paidAt = input.paidAt
    ? new Date(input.paidAt)
    : input.horario
      ? new Date(input.horario)
      : input.dataLiquidacao
        ? new Date(`${input.dataLiquidacao}T00:00:00Z`)
        : new Date();

  return {
    txid: input.txid,
    status,
    isPaid,
    paidAt,
  };
}
