"use server";

import { type TeamCode } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { waitForCobActive } from "@/infra/efi/wait-for-cob-active";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  teamCode: z.enum(["AGUIA", "LEAO"]),
  fullName: z.string().min(3).max(120),
  cpf: z.string().min(11).max(14),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  firstPaymentAmount: z.string().regex(/^\d{1,10}\.\d{2}$/),
  monthlyAmount: z.string().regex(/^\d{1,10}\.\d{2}$/),
});

function cleanCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

function toYYYYMMDDUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysUTC(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function randomIdempotencyKey(prefix: string): string {
  const s = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${s}`;
}

function mustEnv(name: string): string {
  const v = process.env[name] ?? "";
  if (!v) throw new Error(`${name} não definido.`);
  return v;
}

export async function startJourney3(formData: FormData) {
  const input = schema.parse({
    teamCode: String(formData.get("teamCode") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    cpf: String(formData.get("cpf") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    firstPaymentAmount: String(formData.get("firstPaymentAmount") ?? ""),
    monthlyAmount: String(formData.get("monthlyAmount") ?? ""),
  });

  const eventId = mustEnv("POWERCAMP_EVENT_ID");
  const ownerUserId = mustEnv("POWERCAMP_OWNER_USER_ID");
  const pixKey = mustEnv("EFI_PIX_KEY");

  const cpf = cleanCpf(input.cpf);
  if (cpf.length !== 11) throw new Error("CPF inválido.");

  const team = await prisma.team.findUnique({
    where: { code: input.teamCode as TeamCode },
    select: { id: true },
  });
  if (!team) throw new Error("Equipe inválida.");

  // 1) PARTICIPANT (unique: @@unique([eventId, cpf]))
  const participant = await prisma.participant.upsert({
    where: { eventId_cpf: { eventId, cpf } },
    update: {
      fullName: input.fullName,
      email: input.email ? input.email : null,
      phone: input.phone ? input.phone : null,
    },
    create: {
      eventId,
      userId: ownerUserId,
      fullName: input.fullName,
      cpf,
      email: input.email ? input.email : null,
      phone: input.phone ? input.phone : null,
    },
    select: { id: true },
  });

  // 2) ENROLLMENT (unique: @@unique([eventId, participantId]))
  const enrollment = await prisma.enrollment.upsert({
    where: {
      eventId_participantId: { eventId, participantId: participant.id },
    },
    update: { teamId: team.id },
    create: {
      eventId,
      participantId: participant.id,
      teamId: team.id,
      status: "PENDING",
      reservedAt: new Date(),
    },
    select: { id: true, eventId: true, participantId: true },
  });

  // 3) Idempotência: se já existe tentativa de pagamento inicial, não recria nada.
  const existingAttempt = await prisma.initialPaymentAttempt.findUnique({
    where: { enrollmentId: enrollment.id },
    select: { id: true },
  });

  if (existingAttempt?.id) {
    redirect(`/enroll/success?enrollmentId=${enrollment.id}`);
  }

  // 4) Cria locrec (QR da recorrência)
  const locrec = await pixAutoClient.locrec.create();

  // 5) Cria COB imediata (pagamento inicial)
  const cob = await pixAutoClient.cob.create({
    calendario: { expiracao: 3600 },
    devedor: { cpf, nome: input.fullName },
    valor: { original: input.firstPaymentAmount },
    chave: pixKey,
    solicitacaoPagador:
      "PowerCamp 2027 - Pagamento inicial + adesão recorrência",
  });

  console.log("[J3] COB criada", { txid: cob.txid, status: cob.status });

  // Aguarda ficar ATIVA (GET /v2/cob/:txid) — isso NÃO significa “paga”,
  // significa apenas “criada e pronta pra pagamento”.
  await waitForCobActive(cob.txid);

  // 6) Persistir tentativa ANTES da Rec (idempotência contra refresh)
  const idempotencyKeyPayment = randomIdempotencyKey(`pay_${enrollment.id}`);

  await prisma.initialPaymentAttempt.create({
    data: {
      enrollmentId: enrollment.id,
      txid: cob.txid,
      status: "CREATED",
      createdAtEfi: new Date(),
      paidAt: null,
      amount: input.firstPaymentAmount,
      payload: {
        locrec,
        cob, // inclui pixCopiaECola, location etc (ótimo pra UI)
      },
      idempotencyKey: idempotencyKeyPayment,
    },
  });

  // 7) Criar Recorrência (Jornada 3)
  const dataInicial = toYYYYMMDDUTC(addDaysUTC(2));
  const dataFinal = toYYYYMMDDUTC(addDaysUTC(365));
  const idempotencyKeyRec = randomIdempotencyKey(`rec_${participant.id}`);

  const rec = await pixAutoClient.rec.create({
    vinculo: {
      contrato: enrollment.id,
      devedor: { cpf, nome: input.fullName },
      objeto: "PowerCamp 2027 - Mensalidade",
    },
    calendario: {
      dataInicial,
      dataFinal,
      periodicidade: "MENSAL",
    },
    valor: { valorRec: input.monthlyAmount },
    politicaRetentativa: "NAO_PERMITE",
    loc: locrec.id,
    ativacao: { dadosJornada: { txid: cob.txid } },
  });

  // 8) Buscar detalhes/QR da Recorrência (pode vir vazio no primeiro instante)
  const recGet = await pixAutoClient.rec.get(rec.idRec, { txid: cob.txid });

  const pixCopiaEColaRec = recGet.dadosQR?.pixCopiaECola ?? null;
  const jornadaRec = recGet.dadosQR?.jornada ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.pixAutoRecurrence.create({
      data: {
        eventId,
        participantId: participant.id,

        idRec: rec.idRec,
        status: recGet.status ?? rec.status,

        valorRec: input.monthlyAmount,
        periodicidade: "MENSAL",
        dataInicial: new Date(`${dataInicial}T00:00:00.000Z`),
        dataFinal: new Date(`${dataFinal}T00:00:00.000Z`),

        contrato: enrollment.id,
        objeto: "PowerCamp 2027 - Mensalidade",

        locId: locrec.id,
        locationUrl: String(locrec.location),
        pixCopiaECola: pixCopiaEColaRec,
        jornada: jornadaRec,

        idempotencyKey: idempotencyKeyRec,
      },
    });

    // Mantém payload rico pra debug/observabilidade
    await tx.initialPaymentAttempt.update({
      where: { enrollmentId: enrollment.id },
      data: {
        payload: { locrec, cob, rec, recGet },
      },
    });
  });

  redirect(`/enroll/success?enrollmentId=${enrollment.id}`);
}
