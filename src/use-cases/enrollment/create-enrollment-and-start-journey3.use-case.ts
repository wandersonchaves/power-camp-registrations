// src/use-cases/enrollment/create-enrollment-and-start-journey3.use-case.ts
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { buildTxid } from "@/infra/efi/txid";
import { waitForCobActive } from "@/infra/efi/wait-for-cob-active";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type TeamCode = "AGUIA" | "LEAO";
type PaymentMode = "INDIVIDUAL" | "COLLECTIVE";

type Input = {
  eventId: string;
  participantId: string;
  teamCode?: TeamCode | null;
  paymentMode?: PaymentMode;

  immediateAmount: string;
  recurringAmount: string;

  contrato: string;
  objeto?: string | null;

  periodicidade: "MENSAL" | "SEMANAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";
  dataInicial: string;
  dataFinal?: string;

  solicitacaoPagador?: string;
};

type Output = {
  enrollmentId: string;
  txid: string;
  cobPixCopiaECola: string | null;
  idRec: string | null;
  recPixCopiaECola: string | null;
  isTeamCovered?: boolean;
};

function assertEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} não definido.`);
  return v;
}

function normalizeMoney(value: string | number): string {
  const raw =
    typeof value === "number"
      ? String(value)
      : String(value).trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor inválido.");
  return n.toFixed(2);
}

async function waitCobActivatableForRec(txid: string, budgetMs: number) {
  await waitForCobActive(txid, {
    label: "[EFI J3] wait-cob-activatable-for-rec",
    maxTotalMs: budgetMs,
    maxAttempts: 10,
    baseDelayMs: 500,
    maxDelayMs: 2_500,
    multiplier: 1.5,
    jitterMs: 200,
    dedupeTtlMs: 10_000,
    getCacheTtlMs: 1_000,
    minCobAgeMs: 1_500,
    requireConsecutiveActiveReads: 1,
    acceptPaidAsUsable: false,
  });
}

async function tryCreateRecWithTxid(params: {
  txid: string;
  locId: number;
  participant: { cpf: string; fullName: string };
  contrato: string;
  objeto?: string | null;
  periodicidade: Input["periodicidade"];
  dataInicial: string;
  dataFinal?: string;
  recurringAmount: string;
  recAttempts: number;
  recBudgetMs: number;
}) {
  const start = Date.now();

  const recBodyBase = {
    vinculo: {
      contrato: params.contrato,
      devedor: {
        cpf: params.participant.cpf,
        nome: params.participant.fullName,
      },
      ...(params.objeto ? { objeto: params.objeto } : {}),
    },
    calendario: {
      dataInicial: params.dataInicial,
      ...(params.dataFinal ? { dataFinal: params.dataFinal } : {}),
      periodicidade: params.periodicidade,
    },
    valor: { valorRec: params.recurringAmount },
    politicaRetentativa: "NAO_PERMITE" as const,
  };

  for (let attemptN = 1; attemptN <= params.recAttempts; attemptN++) {
    const elapsed = Date.now() - start;
    if (elapsed > params.recBudgetMs) break;

    try {
      const rec = await pixAutoClient.rec.create({
        ...recBodyBase,
        loc: params.locId,
        ativacao: { dadosJornada: { txid: params.txid } },
      });

      const recGet = await pixAutoClient.rec.get(rec.idRec, {
        txid: params.txid,
      });
      return { rec, recGet };
    } catch (err) {
      if (pixAutoClient.errors.isRecLocAlreadyUsed(err)) {
        throw new AppError(
          "locrec já foi utilizado.",
          409,
          "EFI_REC_LOC_ALREADY_USED",
        );
      }
      if (pixAutoClient.errors.isRecActivationTxidNotActive(err)) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function startEfiJourney3WithFallback(params: {
  pixKey: string;
  participant: { cpf: string; fullName: string };
  immediateAmount: string;
  recurringAmount: string;
  contrato: string;
  objeto?: string | null;
  periodicidade: Input["periodicidade"];
  dataInicial: string;
  dataFinal?: string;
  solicitacaoPagador: string;
}) {
  const expSeconds = 3600;
  const txid = buildTxid({
    eventId: "J3",
    kind: "COB_IMMEDIATE",
    enrollmentId: params.contrato,
    participantId: params.participant.cpf,
    installmentIndex: 1,
  });
  const locrec = await pixAutoClient.locrec.create();

  const cob = await pixAutoClient.cob.put(txid, {
    calendario: { expiracao: expSeconds },
    devedor: {
      cpf: params.participant.cpf,
      nome: params.participant.fullName,
    },
    valor: { original: params.immediateAmount },
    chave: params.pixKey,
    ...(params.solicitacaoPagador
      ? { solicitacaoPagador: params.solicitacaoPagador }
      : {}),
  });

  await waitCobActivatableForRec(txid, 15_000);

  const result = await tryCreateRecWithTxid({
    txid,
    locId: locrec.id,
    participant: params.participant,
    contrato: params.contrato,
    objeto: params.objeto ?? null,
    periodicidade: params.periodicidade,
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    recurringAmount: params.recurringAmount,
    recAttempts: 5,
    recBudgetMs: 15_000,
  });

  if (result?.rec?.idRec) {
    return { txid, cob, locrec, rec: result.rec, recGet: result.recGet };
  }
  throw new Error("Falha ao criar recorrência.");
}

export async function createEnrollmentAndStartJourney3UseCase(
  input: Input,
): Promise<Output> {
  const pixKey = assertEnv("EFI_PIX_KEY");
  const participant = await prisma.participant.findUnique({
    where: { id: input.participantId },
    select: { id: true, cpf: true, fullName: true },
  });
  if (!participant) {
    throw new AppError("Participant not found", 404, "PARTICIPANT_NOT_FOUND");
  }

  let teamId: string | null = null;
  if (input.teamCode) {
    const team = await prisma.team.findUnique({
      where: { code: input.teamCode },
      select: { id: true },
    });
    if (!team) throw new AppError("Team not found", 404, "TEAM_NOT_FOUND");
    teamId = team.id;
  }

  const myExistingRecurrence = await prisma.pixAutoRecurrence.findFirst({
    where: {
      participantId: input.participantId,
      eventId: input.eventId,
      status: { in: ["CRIADA", "ATIVA", "APROVADA"] },
    },
    orderBy: { createdAt: "desc" },
    select: { idRec: true, pixCopiaECola: true },
  });

  const existingTeamRecurrence =
    teamId && input.paymentMode === "COLLECTIVE"
      ? await prisma.pixAutoRecurrence.findFirst({
          where: {
            eventId: input.eventId,
            participant: {
              enrollments: {
                some: {
                  teamId: teamId,
                  status: { in: ["PENDING", "CONFIRMED"] },
                },
              },
            },
            status: { in: ["CRIADA", "ATIVA", "APROVADA"] },
          },
          orderBy: { createdAt: "desc" },
          select: { idRec: true, pixCopiaECola: true },
        })
      : null;

  const enrollment = await prisma.enrollment.upsert({
    where: {
      eventId_participantId: {
        eventId: input.eventId,
        participantId: input.participantId,
      },
    },
    update: { ...(teamId ? { teamId } : {}) },
    create: {
      eventId: input.eventId,
      participantId: input.participantId,
      teamId,
      status: "PENDING",
      reservedAt: new Date(),
    },
    select: { id: true, status: true },
  });

  const contrato = `ENR|${input.eventId}|${participant.id}`;

  if (myExistingRecurrence?.idRec) {
    return {
      enrollmentId: enrollment.id,
      txid: "",
      cobPixCopiaECola: null,
      idRec: myExistingRecurrence.idRec,
      recPixCopiaECola: myExistingRecurrence.pixCopiaECola,
    };
  }

  if (input.paymentMode === "COLLECTIVE" && existingTeamRecurrence) {
    const txid = buildTxid({
      eventId: "J1",
      kind: "COB_IMMEDIATE",
      enrollmentId: contrato,
      participantId: participant.cpf,
      installmentIndex: Date.now(),
    });
    const cob = await pixAutoClient.cob.put(txid, {
      calendario: { expiracao: 3600 },
      devedor: { cpf: participant.cpf, nome: participant.fullName },
      valor: { original: normalizeMoney(input.immediateAmount) },
      chave: pixKey,
      solicitacaoPagador: "Inscrição individual (mensalidade via líder)",
    });

    return {
      enrollmentId: enrollment.id,
      txid,
      cobPixCopiaECola: cob.pixCopiaECola || null,
      idRec: existingTeamRecurrence.idRec,
      recPixCopiaECola: existingTeamRecurrence.pixCopiaECola,
      isTeamCovered: true,
    };
  }

  const isLeader = input.paymentMode === "COLLECTIVE";
  const multiplier = isLeader ? 51 : 1;
  const recurringAmount = normalizeMoney(18.3 * multiplier);
  const immediateAmount = normalizeMoney(input.immediateAmount);

  const { txid, cob, rec, recGet } = await startEfiJourney3WithFallback({
    pixKey,
    participant: { cpf: participant.cpf, fullName: participant.fullName },
    immediateAmount,
    recurringAmount,
    contrato,
    objeto: isLeader ? "Mensalidade Coletiva Equipe" : "Mensalidade Individual",
    periodicidade: "MENSAL",
    dataInicial: input.dataInicial,
    dataFinal: input.dataFinal,
    solicitacaoPagador: isLeader
      ? "Ativação Equipe (51 pessoas)"
      : "Inscrição + Mensalidade Individual",
  });

  const recIdempotencyKey = sha256(
    ["REC", enrollment.id, contrato, recurringAmount].join("|"),
  );
  await prisma.pixAutoRecurrence.create({
    data: {
      idempotencyKey: recIdempotencyKey,
      eventId: input.eventId,
      participantId: input.participantId,
      idRec: rec.idRec,
      status: recGet.status || "CRIADA",
      valorRec: recurringAmount,
      periodicidade: "MENSAL",
      dataInicial: new Date(`${input.dataInicial}T00:00:00.000Z`),
      contrato,
      objeto: isLeader
        ? "Mensalidade Coletiva Equipe"
        : "Mensalidade Individual",
      jornada: "JORNADA_3",
      pixCopiaECola: recGet.dadosQR?.pixCopiaECola || null,
      firstCobTxid: txid,
      payload: asInputJson({ activationTxid: txid, recGet }),
    },
  });

  return {
    enrollmentId: enrollment.id,
    txid,
    cobPixCopiaECola:
      recGet.dadosQR?.pixCopiaECola || cob.pixCopiaECola || null,
    idRec: rec.idRec,
    recPixCopiaECola: recGet.dadosQR?.pixCopiaECola || null,
  };
}
