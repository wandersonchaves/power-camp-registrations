// src/use-cases/team-installments/get-installment-overview.use-case.ts
import type { PaymentListRow, TeamInstallmentReadModel } from "./ports";

import {
  buildInstallmentMatrix,
  type TeamMatrix,
} from "@/domain/team-installments/installment-matrix";
import { maskDocument } from "@/domain/team-installments/mask";

/** Linha pronta para a UI: o documento completo nunca sai desta camada. */
export type PaymentView = Omit<PaymentListRow, "payerDocument"> & {
  payerDocumentMasked: string | null;
};

export interface InstallmentOverview {
  matrices: TeamMatrix[];
  unattributed: PaymentView[];
  unconfirmed: PaymentView[];
  outsideMatrix: PaymentView[];
}

const toView = ({ payerDocument, ...rest }: PaymentListRow): PaymentView => ({
  ...rest,
  payerDocumentMasked: maskDocument(payerDocument),
});

export function makeGetInstallmentOverview(deps: {
  readModel: TeamInstallmentReadModel;
  now?: () => Date;
}) {
  return async function getInstallmentOverview(): Promise<InstallmentOverview> {
    const [installments, unattributed, unconfirmed, outside] =
      await Promise.all([
        deps.readModel.listInstallmentsWithPayment(),
        deps.readModel.listPayments({ statuses: ["UNATTRIBUTED"] }),
        deps.readModel.listPayments({ confirmation: "UNCONFIRMED" }),
        deps.readModel.listPayments({ statuses: ["IGNORED", "PARTIAL"] }),
      ]);

    return {
      matrices: buildInstallmentMatrix(
        installments,
        (deps.now ?? (() => new Date()))(),
      ),
      unattributed: unattributed.map(toView),
      unconfirmed: unconfirmed.map(toView),
      outsideMatrix: outside.map(toView),
    };
  };
}
