// src/use-cases/team-installments/search-efi-payments.use-case.ts
import { attributeTeam } from "./attribution";
import type {
  CobPayerLookup,
  PayerAliasLookup,
  PaymentListRow,
  ReceivedPixItem,
  ReceivedPixSource,
  TeamInstallmentReadModel,
  TxidTeamResolver,
} from "./ports";

import { maskDocument } from "@/domain/team-installments/mask";
import { isExactMultiple } from "@/domain/team-installments/money";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30; // janelas pequenas: respeita limites de período da API
const MAX_RANGE_DAYS = 400;
const MAX_PAGES = 100;
const MAX_PAYER_LOOKUPS = 60;
const MANUAL_MATCH_DAYS = 7;

export interface EfiCandidate {
  endToEndId: string;
  txid: string | null;
  amountCents: number;
  installments: number;
  paidAt: Date;
  payerName: string | null;
  payerDocumentMasked: string | null;
  /** Já está no ledger? Então não pode ser registrado de novo. */
  registered: {
    teamCode: string | null;
    status: string;
    confirmation: string;
  } | null;
  suggestedTeamCode: string | null;
  suggestionReason: string | null;
  /** Lançamento manual não confirmado que provavelmente é este Pix. */
  manualMatch: { paymentId: string; teamCode: string | null } | null;
}

export interface EfiSearchResult {
  candidates: EfiCandidate[];
  truncated: boolean;
}

export function makeSearchEfiPayments(deps: {
  source: ReceivedPixSource;
  cobPayers: CobPayerLookup;
  readModel: TeamInstallmentReadModel;
  txidTeams: TxidTeamResolver;
  aliases: PayerAliasLookup;
  installmentAmountCents: number;
}) {
  return async function searchEfiPayments(range: {
    from: Date;
    to: Date;
  }): Promise<EfiSearchResult> {
    const spanDays = (range.to.getTime() - range.from.getTime()) / DAY_MS;
    if (!(spanDays > 0) || spanDays > MAX_RANGE_DAYS) {
      throw new Error(`Período inválido (máximo ${MAX_RANGE_DAYS} dias)`);
    }

    const { items, truncated } = await collect(range, deps);
    if (items.length === 0) return { candidates: [], truncated };

    const [ledger, teams, unconfirmed] = await Promise.all([
      deps.readModel.findPaymentsByEndToEndIds(items.map((i) => i.endToEndId)),
      deps.readModel.listTeams(),
      deps.readModel.listPayments({ confirmation: "UNCONFIRMED" }),
    ]);
    const codeById = new Map(teams.map((t) => [t.id, t.code]));
    const manuals = unconfirmed.filter((p) => p.source === "MANUAL");

    let lookups = 0;
    const candidates: EfiCandidate[] = [];
    for (const item of items) {
      const known = ledger.get(item.endToEndId) ?? null;

      let payerName = item.payerName;
      let payerDocument = item.payerDocument;
      if (!known && !payerName && item.txid && lookups < MAX_PAYER_LOOKUPS) {
        lookups += 1;
        const payer = await deps.cobPayers.findPayer(item.txid);
        payerName = payer?.name ?? null;
        payerDocument = payer?.document ?? payerDocument;
      }

      const suggestion = known
        ? { teamId: null, reason: "" }
        : await attributeTeam(
            { txid: item.txid, payerName },
            { txidTeams: deps.txidTeams, aliases: deps.aliases },
          );
      const suggestedTeamCode = suggestion.teamId
        ? (codeById.get(suggestion.teamId) ?? null)
        : null;

      candidates.push({
        endToEndId: item.endToEndId,
        txid: item.txid,
        amountCents: item.amountCents,
        installments: item.amountCents / deps.installmentAmountCents,
        paidAt: item.paidAt,
        payerName,
        payerDocumentMasked: maskDocument(payerDocument),
        registered: known && {
          teamCode: known.teamCode,
          status: known.status,
          confirmation: known.confirmation,
        },
        suggestedTeamCode,
        suggestionReason: suggestedTeamCode ? suggestion.reason : null,
        manualMatch: known
          ? null
          : findManualMatch(item, suggestedTeamCode, manuals),
      });
    }

    candidates.sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
    return { candidates, truncated };
  };
}

async function collect(
  range: { from: Date; to: Date },
  deps: { source: ReceivedPixSource; installmentAmountCents: number },
) {
  const byId = new Map<string, ReceivedPixItem>();
  let pages = 0;
  let truncated = false;

  for (
    let start = range.from.getTime();
    start < range.to.getTime() && !truncated;
    start += WINDOW_DAYS * DAY_MS
  ) {
    const from = new Date(start);
    const to = new Date(
      Math.min(start + WINDOW_DAYS * DAY_MS, range.to.getTime()),
    );

    let page = 0;
    let totalPages = 1;
    while (page < totalPages) {
      if (pages >= MAX_PAGES) {
        truncated = true;
        break;
      }
      const result = await deps.source.fetchPage({ from, to, page });
      pages += 1;
      totalPages = result.totalPages;
      page += 1;

      for (const item of result.items) {
        if (isExactMultiple(item.amountCents, deps.installmentAmountCents)) {
          byId.set(item.endToEndId, item);
        }
      }
    }
  }
  return { items: Array.from(byId.values()), truncated };
}

/** Mesmo valor, até 7 dias de distância e equipe compatível; só se for inequívoco. */
function findManualMatch(
  item: ReceivedPixItem,
  suggestedTeamCode: string | null,
  manuals: PaymentListRow[],
) {
  const matches = manuals.filter(
    (m) =>
      m.amountCents === item.amountCents &&
      Math.abs(m.paidAt.getTime() - item.paidAt.getTime()) <=
        MANUAL_MATCH_DAYS * DAY_MS &&
      (!suggestedTeamCode || !m.teamCode || m.teamCode === suggestedTeamCode),
  );
  return matches.length === 1
    ? { paymentId: matches[0].id, teamCode: matches[0].teamCode }
    : null;
}
