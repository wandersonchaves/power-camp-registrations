// src/infra/team-installments/prisma-resolvers.ts
import type { PrismaClient } from "@prisma/client";

import type {
  PayerAliasLookup,
  TxidTeamResolver,
} from "@/use-cases/team-installments/ports";

/**
 * txid -> equipe via cobranças do próprio sistema:
 * 1) InitialPaymentAttempt -> Enrollment.teamId
 * 2) PixCobImmediate -> Participant -> Enrollments (só se houver UMA equipe distinta)
 */
export class PrismaTxidTeamResolver implements TxidTeamResolver {
  constructor(private readonly client: PrismaClient) {}

  async findTeamId(txid: string) {
    const attempt = await this.client.initialPaymentAttempt.findFirst({
      where: { txid, enrollment: { teamId: { not: null } } },
      select: { enrollment: { select: { teamId: true } } },
    });
    if (attempt?.enrollment.teamId) return attempt.enrollment.teamId;

    const cob = await this.client.pixCobImmediate.findUnique({
      where: { txid },
      select: {
        participant: {
          select: {
            enrollments: {
              where: { teamId: { not: null } },
              select: { teamId: true },
            },
          },
        },
      },
    });
    const teams = new Set(
      cob?.participant?.enrollments.map((e) => e.teamId) ?? [],
    );
    return teams.size === 1 ? (Array.from(teams)[0] as string) : null;
  }
}

export class PrismaPayerAliasLookup implements PayerAliasLookup {
  constructor(private readonly client: PrismaClient) {}

  async findTeamId(normalizedName: string) {
    const alias = await this.client.teamPayerAlias.findUnique({
      where: { normalizedName },
      select: { teamId: true },
    });
    return alias?.teamId ?? null;
  }
}
