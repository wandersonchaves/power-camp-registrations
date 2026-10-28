// src/domain/team-installments/normalize-name.ts

/** "  José  da Silva-LTDA. " -> "jose da silva ltda" (chave estável de alias). */
export function normalizePayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
