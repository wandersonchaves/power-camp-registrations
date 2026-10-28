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

import {
  EfiCobPayerLookup,
  EfiPixReceivedClient,
} from "@/infra/efi/pix-received.client";
import { prisma } from "@/lib/prisma";
import { makeAssignPaymentToTeam } from "@/use-cases/team-installments/assign-payment-to-team.use-case";
import { makeGetInstallmentOverview } from "@/use-cases/team-installments/get-installment-overview.use-case";
import { makePromotePayment } from "@/use-cases/team-installments/promote-payment.use-case";
import { makeReconcileTeamPayments } from "@/use-cases/team-installments/reconcile-team-payments.use-case";
import { makeRecordTeamPayment } from "@/use-cases/team-installments/record-team-payment.use-case";
import {
  makeConfirmManualWithEfi,
  makeRegisterEfiPayments,
} from "@/use-cases/team-installments/register-efi-payments.use-case";
import { makeSearchEfiPayments } from "@/use-cases/team-installments/search-efi-payments.use-case";

export function buildTeamInstallments(client = prisma) {
  const { installmentAmountCents } = getTeamInstallmentConfig();
  const uow = new PrismaTeamLedgerUnitOfWork(client);

  const txidTeams = new PrismaTxidTeamResolver(client);
  const aliases = new PrismaPayerAliasLookup(client);
  const efiSource = new EfiPixReceivedClient();
  const cobPayers = new EfiCobPayerLookup(async (txid) =>
    // carga tardia: o cliente Pix Automático só é preciso ao enriquecer um pagador
    (await import("@/infra/efi/pix-auto.client")).pixAutoClient.cob.get(txid),
  );

  const recordTeamPayment = makeRecordTeamPayment({
    uow,
    txidTeams,
    aliases,
    installmentAmountCents,
    newId: randomUUID,
  });

  const readModel = new PrismaTeamInstallmentReadModel(client);
  const promotePayment = makePromotePayment({ uow, installmentAmountCents });

  return {
    readModel,
    getInstallmentOverview: makeGetInstallmentOverview({ readModel }),
    assignPaymentToTeam: makeAssignPaymentToTeam({
      uow,
      installmentAmountCents,
    }),
    recordTeamPayment,
    reconcileTeamPayments: makeReconcileTeamPayments({
      source: efiSource,
      recordTeamPayment,
      installmentAmountCents,
    }),
    searchEfiPayments: makeSearchEfiPayments({
      source: efiSource,
      cobPayers,
      readModel,
      txidTeams,
      aliases,
      installmentAmountCents,
    }),
    registerEfiPayments: makeRegisterEfiPayments({
      source: efiSource,
      cobPayers,
      recordTeamPayment,
    }),
    confirmManualWithEfi: makeConfirmManualWithEfi({
      source: efiSource,
      readModel,
      promotePayment,
    }),
    promotePayment,
  };
}

let singleton: ReturnType<typeof buildTeamInstallments> | null = null;

export function getTeamInstallments() {
  return (singleton ??= buildTeamInstallments());
}
