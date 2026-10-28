// src/infra/team-installments/container.ts
// Composition root: único lugar que liga use-cases a adaptadores concretos.
import { randomUUID } from "node:crypto";

import { getTeamInstallmentConfig } from "./config";
import {
  PrismaPayerAliasLookup,
  PrismaTxidTeamResolver,
} from "./prisma-resolvers";
import { PrismaTeamLedgerUnitOfWork } from "./prisma-team-ledger";

import { prisma } from "@/lib/prisma";
import { makePromotePayment } from "@/use-cases/team-installments/promote-payment.use-case";
import { makeRecordTeamPayment } from "@/use-cases/team-installments/record-team-payment.use-case";

export function buildTeamInstallments(client = prisma) {
  const { installmentAmountCents } = getTeamInstallmentConfig();
  const uow = new PrismaTeamLedgerUnitOfWork(client);

  return {
    recordTeamPayment: makeRecordTeamPayment({
      uow,
      txidTeams: new PrismaTxidTeamResolver(client),
      aliases: new PrismaPayerAliasLookup(client),
      installmentAmountCents,
      newId: randomUUID,
    }),
    promotePayment: makePromotePayment({ uow, installmentAmountCents }),
  };
}

let singleton: ReturnType<typeof buildTeamInstallments> | null = null;

export function getTeamInstallments() {
  return (singleton ??= buildTeamInstallments());
}
