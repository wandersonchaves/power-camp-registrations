// src/domain/team-installments/money.ts
// Dinheiro sempre em centavos inteiros: nenhum cálculo passa por ponto flutuante.

const DECIMAL_REGEX = /^(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Converte "933.30" / "933,30" / "933" em centavos (93330) por parsing de string.
 * Retorna null para qualquer entrada inválida ou não positiva.
 */
export function parseReaisToCents(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = DECIMAL_REGEX.exec(value.trim());
  if (!match) return null;

  const [, reais, fraction = ""] = match;
  const cents = Number(reais) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function isExactMultiple(amountCents: number, unitCents: number) {
  return (
    Number.isInteger(amountCents) &&
    Number.isInteger(unitCents) &&
    unitCents > 0 &&
    amountCents > 0 &&
    amountCents % unitCents === 0
  );
}

/** 93330 -> "R$ 933,30" */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}R$ ${reais},${String(abs % 100).padStart(2, "0")}`;
}
