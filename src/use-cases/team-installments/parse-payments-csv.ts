// src/use-cases/team-installments/parse-payments-csv.ts
import type { TeamPaymentConfirmation, TeamPaymentSource } from "./ports";

import { parseReaisToCents } from "@/domain/team-installments/money";

export const TEAM_CODES = ["AGUIA", "LEAO"] as const;
export type TeamCodeValue = (typeof TEAM_CODES)[number];

export interface ParsedPaymentRow {
  line: number;
  endToEndId: string | null;
  txid: string | null;
  amountCents: number;
  paidAt: Date;
  teamCode: TeamCodeValue | null;
  payerName: string | null;
  source: TeamPaymentSource;
  confirmation: TeamPaymentConfirmation;
  reason: string | null;
  note: string | null;
}

export interface ParseResult {
  rows: ParsedPaymentRow[];
  errors: { line: number; message: string }[];
}

const REQUIRED = ["data", "valor"] as const;

/** Tokenizer CSV (aspas duplas, vírgula, CRLF, BOM). Devolve linhas com o nº original. */
function tokenize(text: string): { line: number; cells: string[] }[] {
  const out: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let startLine = 1;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endRow = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim() !== ""))
      out.push({ line: startLine, cells });
    cells = [];
    cell = "";
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === "\n") line += 1;
        cell += ch;
      }
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      endRow();
      line += 1;
      startLine = line;
    } else cell += ch;
  }
  if (cell !== "" || cells.length > 0) endRow();
  return out;
}

const blank = (v: string | undefined) => (v?.trim() ? v.trim() : null);

/**
 * Colunas (cabeçalho obrigatório): e2eid,data,valor,equipe,pagador,origem,confirmacao
 * Opcionais: txid, motivo (attributionReason), nota. Linhas iniciadas por # são comentários.
 */
export function parsePaymentsCsv(text: string): ParseResult {
  const result: ParseResult = { rows: [], errors: [] };
  const lines = tokenize(text).filter(
    (l) => !l.cells[0].trim().startsWith("#"),
  );
  if (lines.length === 0) return result;

  const header = lines[0].cells.map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    result.errors.push({
      line: lines[0].line,
      message: `cabeçalho sem coluna(s): ${missing.join(", ")}`,
    });
    return result;
  }

  for (const { line, cells } of lines.slice(1)) {
    const get = (col: string) => {
      const idx = header.indexOf(col);
      return idx >= 0 ? blank(cells[idx]) : null;
    };
    const fail = (message: string) => result.errors.push({ line, message });

    const amountCents = parseReaisToCents(get("valor") ?? "");
    if (!amountCents) {
      fail("valor inválido");
      continue;
    }

    const rawDate = get("data");
    const paidAt = rawDate ? new Date(rawDate) : null;
    if (!paidAt || Number.isNaN(paidAt.getTime())) {
      fail("data inválida (use ISO 8601, ex.: 2026-03-20T18:22:00Z)");
      continue;
    }

    const team = get("equipe")?.toUpperCase() ?? null;
    if (team && !TEAM_CODES.includes(team as TeamCodeValue)) {
      fail(`equipe desconhecida: ${team}`);
      continue;
    }

    const origem = (get("origem") ?? "IMPORT").toUpperCase();
    if (origem !== "IMPORT" && origem !== "MANUAL") {
      fail("origem deve ser IMPORT ou MANUAL");
      continue;
    }

    const confirmacao = (get("confirmacao") ?? "CONFIRMED").toUpperCase();
    if (confirmacao !== "CONFIRMED" && confirmacao !== "UNCONFIRMED") {
      fail("confirmacao deve ser CONFIRMED ou UNCONFIRMED");
      continue;
    }

    result.rows.push({
      line,
      endToEndId: get("e2eid"),
      txid: get("txid"),
      amountCents,
      paidAt,
      teamCode: team as TeamCodeValue | null,
      payerName: get("pagador"),
      source: origem,
      confirmation: confirmacao,
      reason: get("motivo"),
      note: get("nota"),
    });
  }
  return result;
}
