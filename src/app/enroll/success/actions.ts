// src/app/enroll/success/actions.ts
"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { prisma } from "@/lib/prisma";

function asObject(
  v: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export async function refreshRecurrence(formData: FormData) {
  const enrollmentId = String(formData.get("enrollmentId") ?? "");

  if (!enrollmentId) {
    revalidatePath("/enroll/success");
    redirect("/enroll");
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      eventId: true,
      participantId: true,
      initialPayment: { select: { txid: true, payload: true } },
    },
  });

  // não quebra a navegação; apenas revalida e volta
  if (!enrollment?.initialPayment?.txid) {
    revalidatePath("/enroll/success");
    redirect(
      `/enroll/success?enrollmentId=${encodeURIComponent(enrollmentId)}`,
    );
  }

  const txid = enrollment.initialPayment.txid;

  const recurrence = await prisma.pixAutoRecurrence.findFirst({
    where: {
      eventId: enrollment.eventId,
      participantId: enrollment.participantId,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, idRec: true },
  });

  if (!recurrence?.idRec) {
    revalidatePath("/enroll/success");
    redirect(
      `/enroll/success?enrollmentId=${encodeURIComponent(enrollmentId)}`,
    );
  }

  const recGet = await pixAutoClient.rec.get(recurrence.idRec, { txid });

  const pixCopiaECola = recGet.dadosQR?.pixCopiaECola ?? null;
  const jornada = recGet.dadosQR?.jornada ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.pixAutoRecurrence.update({
      where: { id: recurrence.id },
      data: {
        status: recGet.status ?? undefined,
        ...(pixCopiaECola ? { pixCopiaECola } : {}),
        ...(jornada ? { jornada } : {}),
      },
    });

    // merge seguro (sem sobrescrever o shape inteiro)
    const prev = asObject(enrollment.initialPayment?.payload);

    await tx.initialPaymentAttempt.update({
      where: { enrollmentId },
      data: {
        payload: {
          ...prev,
          recGet,
        },
      },
    });
  });

  revalidatePath("/enroll/success");
  redirect(`/enroll/success?enrollmentId=${encodeURIComponent(enrollmentId)}`);
}
