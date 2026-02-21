"use server";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { prisma } from "@/infra/prisma";

export async function refreshRecQr(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { participant: true },
  });
  if (!enrollment) throw new Error("Enrollment não encontrado.");

  // pega a recorrência mais recente desse participante/evento (ajuste se você salva 1:1)
  const rec = await prisma.pixAutoRecurrence.findFirst({
    where: {
      participantId: enrollment.participantId,
      eventId: enrollment.eventId,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!rec?.idRec) return { ok: true, updated: false };

  // txid do pagamento inicial para query param (como você testou no Postman)
  const attempt = await prisma.initialPaymentAttempt.findUnique({
    where: { enrollmentId },
  });

  const txid = attempt?.txid ?? undefined;
  const recGet = await pixAutoClient.rec.get(
    rec.idRec,
    txid ? { txid } : undefined,
  );

  const pixCopiaECola = recGet.dadosQR?.pixCopiaECola ?? null;
  const jornada = recGet.dadosQR?.jornada ?? null;

  if (!pixCopiaECola && !jornada) return { ok: true, updated: false };

  await prisma.pixAutoRecurrence.update({
    where: { id: rec.id },
    data: {
      pixCopiaECola,
      jornada,
      status: recGet.status ?? rec.status,
    },
  });

  return { ok: true, updated: true };
}
