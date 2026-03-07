import { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { prisma } from "@/lib/prisma";

function sanitize(obj: Record<string, unknown> | null | undefined) {
  if (!obj) return obj;
  const { pixCopiaECola, dadosQR, ...rest } = obj;
  return {
    ...rest,
    qr_preview: pixCopiaECola
      ? String(pixCopiaECola).substring(0, 20) + "..."
      : undefined,
    dadosQR_preview: (dadosQR as Record<string, unknown> | undefined)
      ?.pixCopiaECola
      ? String((dadosQR as Record<string, unknown>).pixCopiaECola).substring(
          0,
          20,
        ) + "..."
      : undefined,
  };
}

export async function generateJ2Qr(recurrenceId: string) {
  const recurrence = await prisma.pixAutoRecurrence.findUnique({
    where: { id: recurrenceId },
    include: { participant: true },
  });

  if (!recurrence || !recurrence.idRec) {
    throw new Error("Recorrência não encontrada ou sem idRec");
  }

  // 1. Chamar Efí: GET /v2/rec/:id
  const efiResponse = (await pixAutoClient.rec.get(recurrence.idRec)) as Record<
    string,
    unknown
  >;

  const pixCopiaECola =
    (efiResponse.dadosQR as Record<string, unknown> | undefined)
      ?.pixCopiaECola || efiResponse.pixCopiaECola;

  if (!pixCopiaECola) {
    throw new Error("Efí não retornou pixCopiaECola para Jornada 2");
  }

  // 2. Atualizar ou Criar controle de migração
  const migration = await prisma.pixAutoMigration.upsert({
    where: { recurrenceId: recurrence.id },
    create: {
      recurrenceId: recurrence.id,
      status: "QR_GENERATED",
      consentQrCode: String(pixCopiaECola),
      attempts: 1,
      generatedAt: new Date(),
      metadata: {
        efiResponse: sanitize(efiResponse),
        originalTxid: recurrence.firstCobTxid,
      } as Prisma.InputJsonValue,
    },
    update: {
      status: "QR_GENERATED",
      consentQrCode: String(pixCopiaECola),
      attempts: { increment: 1 },
      generatedAt: new Date(),
      metadata: {
        lastEfiResponse: sanitize(efiResponse),
        originalTxid: recurrence.firstCobTxid,
      } as Prisma.InputJsonValue,
    },
  });

  // 3. Auditoria
  await prisma.migrationAuditLog.create({
    data: {
      migrationId: migration.id,
      action: "QR_GENERATED",
      payload: sanitize(efiResponse) as Prisma.InputJsonValue,
    },
  });

  return { success: true, pixCopiaECola: String(pixCopiaECola) };
}
