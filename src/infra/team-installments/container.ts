// src/infra/team-installments/container.ts
// Composition root: único lugar que liga use-cases a adaptadores concretos.
import { randomUUID } from "node:crypto";

import { getTeamInstallmentConfig } from "./config";
import { PrismaTeamInstallmentReadModel } from "./prisma-read-model";
import {
  PrismaPayerAliasLookup,
  PrismaTxidTeamResolver,
} from "./prisma-resolvers";
import { PrismaTeamLedgerUnitOfWork } from "./prisma-team-ledger";

import { EfiPixReceivedClient } from "@/infra/efi/pix-received.client";
import { prisma } from "@/lib/prisma";
import { makeAssignPaymentToTeam } from "@/use-cases/team-installments/assign-payment-to-team.use-case";
import { makeGetInstallmentOverview } from "@/use-cases/team-installments/get-installment-overview.use-case";
import { makePromotePayment } from "@/use-cases/team-installments/promote-payment.use-case";
import { makeReconcileTeamPayments } from "@/use-cases/team-installments/reconcile-team-payments.use-case";
import { makeRecordTeamPayment } from "@/use-cases/team-installments/record-team-payment.use-case";

export function buildTeamInstallments(client = prisma) {
  const { installmentAmountCents } = getTeamInstallmentConfig();
  const uow = new PrismaTeamLedgerUnitOfWork(client);

  const recordTeamPayment = makeRecordTeamPayment({
    uow,
    txidTeams: new PrismaTxidTeamResolver(client),
    aliases: new PrismaPayerAliasLookup(client),
    installmentAmountCents,
    newId: randomUUID,
  });

  const readModel = new PrismaTeamInstallmentReadModel(client);

  return {
    readModel,
    getInstallmentOverview: makeGetInstallmentOverview({ readModel }),
    assignPaymentToTeam: makeAssignPaymentToTeam({
      uow,
      installmentAmountCents,
    }),
    recordTeamPayment,
    reconcileTeamPayments: makeReconcileTeamPayments({
      source: new EfiPixReceivedClient(),
      recordTeamPayment,
      installmentAmountCents,
    }),
    promotePayment: makePromotePayment({ uow, installmentAmountCents }),
  };
}

let singleton: ReturnType<typeof buildTeamInstallments> | null = null;

export function getTeamInstallments() {
  return (singleton ??= buildTeamInstallments());
}
