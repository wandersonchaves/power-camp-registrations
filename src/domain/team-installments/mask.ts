// src/domain/team-installments/mask.ts

/** Nunca expõe documento completo: mantém só os 2 últimos dígitos. */
export function maskDocument(document: string | null): string | null {
  if (!document) return null;
  const digits = document.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `${"•".repeat(Math.min(digits.length - 2, 9))}${digits.slice(-2)}`;
}
