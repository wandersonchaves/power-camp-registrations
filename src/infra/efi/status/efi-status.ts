// src/infra/efi/status/efi-status.ts
import type { EnrollmentStatus, PaymentStatus } from "@prisma/client";

export type EfiCobStatus =
  | "ATIVA"
  | "CONCLUIDA"
  | "REMOVIDA_PELO_USUARIO_RECEBEDOR"
  | "REMOVIDA_PELO_PSP";

export function mapEfiCobToPaymentStatus(s: string): PaymentStatus | null {
  switch (s) {
    case "ATIVA":
      return "ACTIVE";
    case "CONCLUIDA":
      return "PAID";
    case "REMOVIDA_PELO_USUARIO_RECEBEDOR":
    case "REMOVIDA_PELO_PSP":
      return "CANCELLED";
    default:
      return null; // desconhecido (não quebra)
  }
}

export function mapPaymentToEnrollment(
  payment: PaymentStatus,
): EnrollmentStatus | null {
  switch (payment) {
    case "PAID":
      return "CONFIRMED";
    case "CANCELLED":
    case "FAILED":
    case "EXPIRED":
      // depende da regra do seu produto — muitas vezes mantém PENDING e só cancela manual
      return "CANCELLED";
    default:
      return null;
  }
}
