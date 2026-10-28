// src/infra/team-installments/config.ts
const DEFAULT_INSTALLMENT_AMOUNT_CENTS = 93330;

export function getTeamInstallmentConfig() {
  const raw = process.env.TEAM_INSTALLMENT_AMOUNT_CENTS;
  const installmentAmountCents = raw
    ? Number(raw)
    : DEFAULT_INSTALLMENT_AMOUNT_CENTS;

  if (
    !Number.isSafeInteger(installmentAmountCents) ||
    installmentAmountCents <= 0
  ) {
    throw new Error(
      "TEAM_INSTALLMENT_AMOUNT_CENTS inválido (inteiro em centavos)",
    );
  }

  return {
    installmentAmountCents,
    enabled: process.env.TEAM_INSTALLMENTS_ENABLED === "true",
  };
}
