// src/use-cases/enrollment/create-enrollment-and-start-journey3.use-case.ts
import type { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import type { CobResponse } from "@/infra/efi/pix-auto.types";
import { buildTxid } from "@/infra/efi/txid";
import { waitForCobActive } from "@/infra/efi/wait-for-cob-active";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type TeamCode = "AGUIA" | "LEAO";

type Input = {
  eventId: string;
  participantId: string;

  teamCode?: TeamCode | null;

  immediateAmount: string;
  recurringAmount: string;

  contrato: string;
  objeto?: string | null;

  periodicidade: "MENSAL" | "SEMANAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";
  dataInicial: string; // YYYY-MM-DD
  dataFinal?: string; // YYYY-MM-DD

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

type AttemptTicketPayload = {
  txidRevision?: number;
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

function isJsonObject(
  v: Prisma.JsonValue | null | undefined,
): v is Prisma.JsonObject {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function readTicketJson(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || !isJsonObject(payload)) return {};
  const t = payload["ticket"];
  return t && typeof t === "object" && !Array.isArray(t)
    ? (t as Record<string, unknown>)
    : {};
}

function getTxidRevision(payload: Prisma.JsonValue | null | undefined): number {
  if (!payload || !isJsonObject(payload)) return 0;
  const ticket = payload["ticket"];
  if (!ticket || typeof ticket !== "object" || Array.isArray(ticket)) return 0;

  const rev = (ticket as Record<string, unknown>)["txidRevision"];
  const n = Number(rev);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function makeContratoEfi(params: {
  inputContrato: string | null | undefined;
  enrollmentId: string;
  participantId: string;
  eventId: string;
}): string {
  const raw = String(params.inputContrato ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (/^\d{8}$/.test(digits)) return digits;

  const seed = `${params.eventId}|${params.participantId}|${params.enrollmentId}`;
  const h = sha256(seed);
  const onlyDigits = h.replace(/\D/g, "");

  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);

  const safeDigits =
    onlyDigits.length >= 12 ? onlyDigits : String(sum).repeat(5);

  return safeDigits.slice(-8).padStart(8, "7");
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
  let serverErrorStreak = 0;

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
          "locrec já foi utilizado. Recrie a loc e tente novamente.",
          409,
          "EFI_REC_LOC_ALREADY_USED",
          { txid: params.txid, locId: params.locId },
        );
      }

      if (pixAutoClient.errors.isRecActivationTxidNotActive(err)) {
        const backoffMs =
          Math.min(3_000, 800 + attemptN * 700) +
          Math.floor(Math.random() * 200);

        log("info", "[EFI REC] txid-not-active", {
          txid: params.txid,
          attempt: attemptN,
          sleepMs: backoffMs,
        });

        await new Promise((r) => setTimeout(r, backoffMs));
        serverErrorStreak = 0;
        continue;
      }

      if (pixAutoClient.errors.isRecInternalServerError(err)) {
        serverErrorStreak += 1;
        if (serverErrorStreak >= 2) {
          throw new AppError(
            "Efí retornou erro interno (5xx) repetidamente ao criar recorrência.",
            502,
            "EFI_REC_SERVER_ERROR",
            { txid: params.txid, streak: serverErrorStreak },
          );
        }

        const backoffMs = 1000;
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      if (pixAutoClient.errors.isContratoAlreadyHasActiveRecurrence(err)) {
        throw new AppError(
          "Contrato já possui recorrência ativa na Efí. Use outro contrato ou cancele a recorrência existente.",
          409,
          "EFI_REC_CONTRATO_ALREADY_ACTIVE",
          err,
        );
      }

      if (pixAutoClient.errors.isRecTxidExpired(err)) {
        throw new AppError(
          "A cobrança imediata (txid) expirou durante a criação da recorrência.",
          409,
          "EFI_J3_TXID_EXPIRED",
          { txid: params.txid },
        );
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

  cobCycles?: number;
  cobActivatableBudgetMs?: number;

  recAttempts?: number;
  recBudgetMs?: number;
}) {
  const expSeconds = 3600;
  const cobCycles = params.cobCycles ?? 2;
  const cobActivatableBudgetMs = params.cobActivatableBudgetMs ?? 12_000;
  const recAttempts = params.recAttempts ?? 5;
  const recBudgetMs = params.recBudgetMs ?? 12_000;

  let lastCob: CobResponse | null = null;
  let lastLocrec: { id: number; location?: string | null } | null = null;

  for (let cycle = 1; cycle <= cobCycles; cycle++) {
    const txid = buildTxid({
      eventId: "J3",
      kind: "COB_IMMEDIATE",
      enrollmentId: params.contrato,
      participantId: params.participant.cpf,
      installmentIndex: cycle,
    });

    const locrec = await pixAutoClient.locrec.create();
    lastLocrec = { id: locrec.id, location: locrec.location ?? null };

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
    lastCob = cob;

    if (pixAutoClient.errors.cob.isTerminalNotUsableStatus(cob.status)) {
      throw new AppError(
        `A cobrança (txid) está ${String(cob.status)} e não pode ser usada para Jornada 3.`,
        409,
        "EFI_J3_TXID_NOT_USABLE",
        { txid, cobStatus: cob.status },
      );
    }

    log("info", "[EFI J3] cycle created cob/loc", {
      cycle,
      txid,
      locId: locrec.id,
    });

    await waitCobActivatableForRec(txid, cobActivatableBudgetMs);

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
      recAttempts,
      recBudgetMs,
    });

    if (result?.rec?.idRec) {
      return { txid, cob, locrec, rec: result.rec, recGet: result.recGet };
    }

    log("warn", "[EFI J3] rec did not converge; rotating txid", {
      cycle,
      txid,
    });
  }

  throw new AppError(
    "Falha ao criar recorrência coletiva: Efí não ativou o txid a tempo.",
    502,
    "EFI_REC_CREATE_TIMEOUT",
    {
      lastTxid: String(lastCob?.txid ?? ""),
      lastLocId: lastLocrec?.id ?? null,
    },
  );
}

export async function createEnrollmentAndStartJourney3UseCase(
  input: Input,
): Promise<Output> {
  const pixKey = assertEnv("EFI_PIX_KEY");

  const participant = await prisma.participant.findUnique({
    where: { id: input.participantId },
    select: { id: true, cpf: true, fullName: true },
  });
  if (!participant)
    throw new AppError("Participant not found", 404, "PARTICIPANT_NOT_FOUND");

  let teamId: string | null = null;
  if (input.teamCode) {
    const team = await prisma.team.findUnique({
      where: { code: input.teamCode },
      select: { id: true },
    });
    if (!team) throw new AppError("Team not found", 404, "TEAM_NOT_FOUND");
    teamId = team.id;
  }

  // 1. Verificar se JÁ EXISTE uma recorrência ativa vinculada especificamente a ESTE participante
  const myExistingRecurrence = await prisma.pixAutoRecurrence.findFirst({
    where: {
      participantId: input.participantId,
      eventId: input.eventId,
      status: { in: ["CRIADA", "ATIVA", "APROVADA"] },
    },
    orderBy: { createdAt: "desc" },
    select: { idRec: true, pixCopiaECola: true },
  });

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

  const contrato = makeContratoEfi({
    inputContrato: input.contrato,
    enrollmentId: enrollment.id,
    participantId: input.participantId,
    eventId: input.eventId,
  });

  // Se já tem recorrência própria, retorna ela
  if (myExistingRecurrence?.idRec) {
    return {
      enrollmentId: enrollment.id,
      txid: "",
      cobPixCopiaECola: null,
      idRec: myExistingRecurrence.idRec,
      recPixCopiaECola: myExistingRecurrence.pixCopiaECola,
    };
  }

  // ✅ REGRAS FINANCEIRAS: Base de 18.30 por pessoa * 50 pessoas = 915.00
  const immediateAmount = normalizeMoney(input.immediateAmount);
  const individualRecurring = 18.3;
  const teamRecurringAmount = normalizeMoney(individualRecurring * 50); // Resulta em "915.00"

  // Se confirmado mas sem recorrência (seu caso), continua para gerar a recorrência

  const paymentIdempotencyKey = sha256(
    [
      enrollment.id,
      immediateAmount,
      teamRecurringAmount,
      input.periodicidade,
      input.dataInicial,
      input.dataFinal ?? "",
      contrato,
      input.objeto ?? "",
    ].join("|"),
  );

  const existingAttempt = await prisma.initialPaymentAttempt.findUnique({
    where: { enrollmentId: enrollment.id },
    select: { id: true, payload: true, idempotencyKey: true, paidAt: true },
  });

  let txidRevision = getTxidRevision(existingAttempt?.payload);
  if (
    existingAttempt &&
    !existingAttempt.paidAt &&
    existingAttempt.idempotencyKey &&
    existingAttempt.idempotencyKey !== paymentIdempotencyKey
  ) {
    txidRevision += 1;
  }

  const attempt = await prisma.initialPaymentAttempt.upsert({
    where: { enrollmentId: enrollment.id },
    update: {
      idempotencyKey: paymentIdempotencyKey,
      amount: immediateAmount,
      payload: asInputJson({
        ...(existingAttempt?.payload && isJsonObject(existingAttempt.payload)
          ? existingAttempt.payload
          : {}),
        ticket: {
          ...readTicketJson(existingAttempt?.payload),
          txidRevision,
        } satisfies AttemptTicketPayload,
      }),
    },
    create: {
      enrollmentId: enrollment.id,
      idempotencyKey: paymentIdempotencyKey,
      status: "CREATED",
      amount: immediateAmount,
      txid: "",
      payload: asInputJson({
        ticket: { txidRevision } satisfies AttemptTicketPayload,
      }),
    },
    select: { id: true },
  });

  const persistAttempt = async (data: {
    txid: string;
    cob?: CobResponse;
    locrec?: unknown;
    rec?: unknown;
    recGet?: unknown;
  }) => {
    const fresh = await prisma.initialPaymentAttempt.findUnique({
      where: { id: attempt.id },
      select: { payload: true },
    });
    await prisma.initialPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        txid: data.txid,
        payload: asInputJson({
          ...(fresh?.payload && isJsonObject(fresh.payload)
            ? fresh.payload
            : {}),
          ...(data.cob ? { cob: data.cob } : {}),
          ...(data.locrec ? { locrec: data.locrec } : {}),
          ...(data.rec ? { rec: data.rec } : {}),
          ...(data.recGet ? { recGet: data.recGet } : {}),
          ticket: {
            ...readTicketJson(fresh?.payload),
            txidRevision,
            paymentIdempotencyKey,
            contrato,
            objeto: input.objeto ?? null,
            periodicidade: input.periodicidade,
            dataInicial: input.dataInicial,
            dataFinal: input.dataFinal ?? null,
            immediateAmount,
            recurringAmount: teamRecurringAmount,
          },
        }),
      },
    });
  };

  const solicitacaoPagador = "Ativação recorrente equipe (50 pessoas)";

  const { txid, cob, locrec, rec, recGet } = await startEfiJourney3WithFallback(
    {
      pixKey,
      participant: { cpf: participant.cpf, fullName: participant.fullName },
      immediateAmount,
      recurringAmount: teamRecurringAmount,
      contrato,
      objeto: input.objeto ?? null,
      periodicidade: input.periodicidade,
      dataInicial: input.dataInicial,
      dataFinal: input.dataFinal,
      solicitacaoPagador,
      cobCycles: 2,
      cobActivatableBudgetMs: 12_000,
      recAttempts: 5,
      recBudgetMs: 12_000,
    },
  );

  await persistAttempt({ txid, cob, locrec, rec, recGet });

  await prisma.$transaction(async (tx) => {
    const recIdempotencyKey = sha256(
      [
        "REC",
        enrollment.id,
        contrato,
        input.periodicidade,
        input.dataInicial,
        input.dataFinal ?? "",
        teamRecurringAmount,
      ].join("|"),
    );
    await tx.pixAutoRecurrence.upsert({
      where: { idempotencyKey: recIdempotencyKey },
      update: {
        idRec: rec.idRec,
        status: recGet.status ?? "CRIADA",
        locId: locrec.id,
        locationUrl: locrec.location,
        jornada: recGet.dadosQR?.jornada ?? "JORNADA_3",
        pixCopiaECola: recGet.dadosQR?.pixCopiaECola ?? null,
        firstCobTxid: txid,
        valorRec: teamRecurringAmount,
        periodicidade: input.periodicidade,
        dataInicial: new Date(`${input.dataInicial}T00:00:00.000Z`),
        dataFinal: input.dataFinal
          ? new Date(`${input.dataFinal}T00:00:00.000Z`)
          : null,
        contrato,
        objeto: input.objeto ?? null,
        payload: asInputJson({ activationTxid: txid, recGet }),
      },
      create: {
        idempotencyKey: recIdempotencyKey,
        eventId: input.eventId,
        participantId: input.participantId,
        idRec: rec.idRec,
        status: recGet.status ?? "CRIADA",
        valorRec: teamRecurringAmount,
        periodicidade: input.periodicidade,
        dataInicial: new Date(`${input.dataInicial}T00:00:00.000Z`),
        dataFinal: input.dataFinal
          ? new Date(`${input.dataFinal}T00:00:00.000Z`)
          : null,
        contrato,
        objeto: input.objeto ?? null,
        locId: locrec.id,
        locationUrl: locrec.location,
        jornada: recGet.dadosQR?.jornada ?? "JORNADA_3",
        pixCopiaECola: recGet.dadosQR?.pixCopiaECola ?? null,
        firstCobTxid: txid,
        payload: asInputJson({
          createdFrom: "journey3/enroll/manual-leader",
          activationTxid: txid,
          locrec,
          rec,
          recGet,
        }),
      },
    });
  });

  return {
    enrollmentId: enrollment.id,
    txid,
    cobPixCopiaECola: recGet.dadosQR?.pixCopiaECola || null,
    idRec: rec.idRec,
    recPixCopiaECola: recGet.dadosQR?.pixCopiaECola || null,
  };
}
