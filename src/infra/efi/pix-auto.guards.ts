import type { EfiPixLite } from "@/infra/efi/pix-auto.types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function extractPixLite(pix: unknown): EfiPixLite[] {
  if (!Array.isArray(pix)) return [];
  const out: EfiPixLite[] = [];

  for (const item of pix) {
    if (!isRecord(item)) continue;
    const horario = typeof item.horario === "string" ? item.horario : undefined;
    const endToEndId =
      typeof item.endToEndId === "string" ? item.endToEndId : undefined;
    const valor = typeof item.valor === "string" ? item.valor : undefined;

    out.push({ horario, endToEndId, valor });
  }

  return out;
}
