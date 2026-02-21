// src/use-cases/webhooks/map-efi-webhook.ts

export type PaymentWebhookEvent = {
  txid: string;
  paidAt: Date;
  isPaid: boolean;
};

// Mantém o linter feliz e evita "any"
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNested(obj: JsonObject, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function pickFirstString(
  payload: JsonObject,
  paths: string[][],
): string | null {
  for (const path of paths) {
    const v = getNested(payload, path);
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

function pickFirstUnknown(payload: JsonObject, paths: string[][]): unknown {
  for (const path of paths) {
    const v = getNested(payload, path);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }

  if (typeof value === "number") {
    // Caso venha epoch ms
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

function normalizeStatus(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.toUpperCase().trim();
}

function statusLooksPaid(status: string): boolean {
  // Ajuste fino quando você tiver o payload real.
  return (
    status.includes("LIQ") || // LIQUIDADO
    status.includes("CONCL") || // CONCLUIDO
    status.includes("PAGA") || // PAGA/PAGO
    status.includes("PAID") ||
    status.includes("REALIZ") // REALIZADO (alguns PSPs usam)
  );
}

export function mapEfiWebhookToPaymentEvent(
  payload: unknown,
): PaymentWebhookEvent | null {
  if (!isObject(payload)) return null;

  const txid = pickFirstString(payload, [
    ["txid"],
    ["data", "txid"],
    ["pix", "txid"],
    ["cob", "txid"],
    ["cobr", "txid"],
  ]);

  if (!txid) return null;

  const statusRaw = pickFirstUnknown(payload, [
    ["status"],
    ["data", "status"],
    ["pix", "status"],
    ["cob", "status"],
    ["cobr", "status"],
  ]);

  const status = normalizeStatus(statusRaw);
  const isPaid = statusLooksPaid(status);

  const paidAtRaw = pickFirstUnknown(payload, [
    ["paidAt"],
    ["data", "paidAt"],
    ["dataLiquidacao"],
    ["pix", "horario"],
    ["cob", "horario"],
    ["cobr", "horario"],
  ]);

  // Se não tiver horário confiável, use agora (mas prefira o do PSP)
  const paidAt = parseDate(paidAtRaw) ?? new Date();

  return { txid, paidAt, isPaid };
}
