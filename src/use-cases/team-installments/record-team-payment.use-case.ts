// src/use-cases/team-installments/record-team-payment.use-case.ts
import { attributeTeam } from "./attribution";
import type {
  PayerAliasLookup,
  PaymentPatch,
  TeamLedgerUnitOfWork,
  TeamPaymentConfirmation,
  TeamPaymentSource,
  TxidTeamResolver,
} from "./ports";
import { reallocateTeam } from "./reallocate-team";

import { isExactMultiple } from "@/domain/team-installments/money";

export interface RecordTeamPaymentInput {
  /** Ausente apenas em lançamento MANUAL: vira a chave sintética MANUAL-<id>. */
  endToEndId?: string | null;
  txid?: string | null;
  amountCents: number;
  paidAt: Date;
  payerName?: string | null;
  payerDocument?: string | null;
  source: TeamPaymentSource;
  confirmation?: TeamPaymentConfirmation;
  /** Equipe informada por humano (lançamento manual / importação). */
  teamId?: string | null;
  attributionReason?: string | null;
  createdByUserId?: string | null;
  userEmail?: string | null;
  note?: string | null;
}

export type RecordTeamPaymentResult =
  | { outcome: "CREATED" | "EXISTING"; paymentId: string }
  | { outcome: "SKIPPED"; reason: "NOT_MULTIPLE_OF_INSTALLMENT" };

export interface RecordTeamPaymentDeps {
  uow: TeamLedgerUnitOfWork;
  txidTeams: TxidTeamResolver;
  aliases: PayerAliasLookup;
  installmentAmountCents: number;
  newId: () => string;
}

const AUTOMATIC_SOURCES: TeamPaymentSource[] = ["WEBHOOK", "RECONCILIATION"];

export function makeRecordTeamPayment(deps: RecordTeamPaymentDeps) {
  return async function recordTeamPayment(
    input: RecordTeamPaymentInput,
  ): Promise<RecordTeamPaymentResult> {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error("amountCents deve ser um inteiro positivo");
    }

    const multiple = isExactMultiple(
      input.amountCents,
      deps.installmentAmountCents,
    );

    // A conta recebe milhares de Pix alheios: fontes automáticas não os persistem.
    // Importação/manual os guardam como IGNORED para rastreabilidade.
    if (!multiple && AUTOMATIC_SOURCES.includes(input.source)) {
      return { outcome: "SKIPPED", reason: "NOT_MULTIPLE_OF_INSTALLMENT" };
    }

    const endToEndId = input.endToEndId?.trim() || `MANUAL-${deps.newId()}`;
    const attribution = await attributeTeam(input, deps);

    return deps.uow.run(async (ledger) => {
      if (attribution.teamId) await ledger.lockTeam(attribution.teamId);

      const created = await ledger.insertIfAbsent({
        endToEndId,
        txid: input.txid ?? null,
        amountCents: input.amountCents,
        paidAt: input.paidAt,
        payerName: input.payerName ?? null,
        payerDocument: input.payerDocument ?? null,
        teamId: attribution.teamId,
        source: input.source,
        confirmation: input.confirmation ?? "CONFIRMED",
        // provisório: reallocateTeam define o status definitivo
        status: !multiple
          ? "IGNORED"
          : attribution.teamId
            ? "PARTIAL"
            : "UNATTRIBUTED",
        attributionReason: attribution.reason,
        createdByUserId: input.createdByUserId ?? null,
        note: input.note ?? null,
      });

      const payment = await ledger.findByEndToEndId(endToEndId);
      if (!payment) throw new Error("payment_not_found_after_insert");

      if (created) {
        if (attribution.teamId) {
          await reallocateTeam(
            ledger,
            attribution.teamId,
            deps.installmentAmountCents,
          );
        }
        // Fontes automáticas só auditam quando há um admin por trás da ação.
        if (!AUTOMATIC_SOURCES.includes(input.source) || input.userEmail) {
          await ledger.appendAudit({
            paymentId: payment.id,
            teamId: attribution.teamId,
            action: "PAYMENT_RECORDED",
            after: {
              source: input.source,
              confirmation: payment.confirmation,
              amountCents: payment.amountCents,
              attributionReason: attribution.reason,
            },
            userEmail: input.userEmail ?? null,
          });
        }
        return { outcome: "CREATED", paymentId: payment.id };
      }

      // Mesmo Pix chegando por outro canal: apenas completa o que faltava.
      const patch: PaymentPatch = {};
      if (!payment.txid && input.txid) patch.txid = input.txid;
      if (!payment.payerName && input.payerName)
        patch.payerName = input.payerName;
      if (!payment.payerDocument && input.payerDocument)
        patch.payerDocument = input.payerDocument;
      if (
        payment.confirmation === "UNCONFIRMED" &&
        input.confirmation !== "UNCONFIRMED"
      ) {
        patch.confirmation = "CONFIRMED";
      }
      const attributesNow = !payment.teamId && attribution.teamId;
      if (attributesNow) {
        patch.teamId = attribution.teamId;
        patch.attributionReason = attribution.reason;
      }

      if (Object.keys(patch).length > 0) {
        await ledger.updatePayment(payment.id, patch);
        if (attributesNow && attribution.teamId) {
          await reallocateTeam(
            ledger,
            attribution.teamId,
            deps.installmentAmountCents,
          );
        }
      }
      return { outcome: "EXISTING", paymentId: payment.id };
    });
  };
}
