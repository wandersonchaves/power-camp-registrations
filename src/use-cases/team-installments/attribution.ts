// src/use-cases/team-installments/attribution.ts
import type { PayerAliasLookup, TxidTeamResolver } from "./ports";

import { normalizePayerName } from "@/domain/team-installments/normalize-name";

export interface AttributionInput {
  txid?: string | null;
  teamId?: string | null;
  attributionReason?: string | null;
  payerName?: string | null;
}

/**
 * Atribuição de equipe, sem adivinhação silenciosa e sempre com motivo:
 * (a) txid de cobrança do sistema, (b) humano, (c) alias de pagador, (d) nenhuma.
 */
export async function attributeTeam(
  input: AttributionInput,
  deps: { txidTeams: TxidTeamResolver; aliases: PayerAliasLookup },
): Promise<{ teamId: string | null; reason: string }> {
  if (input.txid) {
    const teamId = await deps.txidTeams.findTeamId(input.txid);
    if (teamId) return { teamId, reason: "txid ligado a cobrança do sistema" };
  }

  if (input.teamId) {
    return {
      teamId: input.teamId,
      reason: input.attributionReason?.trim() || "atribuição manual",
    };
  }

  if (input.payerName) {
    const normalized = normalizePayerName(input.payerName);
    const teamId = normalized
      ? await deps.aliases.findTeamId(normalized)
      : null;
    if (teamId) return { teamId, reason: "alias de pagador configurado" };
  }

  return { teamId: null, reason: "equipe não identificada" };
}
