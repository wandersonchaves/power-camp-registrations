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
};

type AttemptTicketPayload = {
  txidRevision?: number;
};

function assertEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} não definido.`);
  return v;
}

function normalizeMoney(value: string): string {
  const raw = String(value).trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Valor inválido.");
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

function extractCobPixFromAttemptPayload(
  payload: Prisma.JsonValue | null | undefined,
): string | null {
  if (!payload || !isJsonObject(payload)) return null;
  const cobPayload = payload["cob"];
  if (
    !cobPayload ||
    typeof cobPayload !== "object" ||
    Array.isArray(cobPayload)
  )
    return null;
  const pix = (cobPayload as Record<string, unknown>)["pixCopiaECola"];
  return typeof pix === "string" ? pix : null;
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

/**
 * ✅ Gate “ativável no /rec”:
 * - /rec tem visão diferente do /cob; então exigimos:
 *   - status ATIVA
 *   - idade mínima (ex: 2s)
 *   - 2 leituras consecutivas ATIVA
 */
async function waitCobActivatableForRec(txid: string, budgetMs: number) {
  await waitForCobActive(txid, {
    label: "[EFI J3] wait-cob-activatable-for-rec",
    maxTotalMs: budgetMs,

    maxAttempts: 15,
    baseDelayMs: 400,
    maxDelayMs: 4_000,
    multiplier: 1.6,
    jitterMs: 300,

    dedupeTtlMs: 10_000,
    getCacheTtlMs: 1_500,

    minCobAgeMs: 4_500, // Aumentado para dar tempo de estabilizar no HMG
    requireConsecutiveActiveReads: 3, // Mais verificações para garantir estabilidade
    acceptPaidAsUsable: false,
  });
}

/**
 * ✅ Tenta criar REC usando um txid específico.
 * Se a Efí disser "txid não está ativa", a decisão de “trocar o txid” fica no caller.
 */
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
        // esse "try" não troca loc aqui; quem chama troca loc/txid em bloco
        throw new AppError(
          "locrec já foi utilizado. Recrie a loc e tente novamente.",
          409,
          "EFI_REC_LOC_ALREADY_USED",
          { txid: params.txid, locId: params.locId },
        );
      }

      if (pixAutoClient.errors.isRecActivationTxidNotActive(err)) {
        const backoffMs =
          Math.min(4_500, 900 + attemptN * 850) +
          Math.floor(Math.random() * 350);

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

        const backoffMs =
          Math.min(3_500, 700 + attemptN * 600) +
          Math.floor(Math.random() * 300);

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

/**
 * ✅ Jornada 3 com fallback:
 * - cria locrec + cob + espera “ativável no /rec”
 * - tenta criar rec
 * - se /rec insistir em “txid não está ativa” por muito tempo:
 *   -> cria NOVA cob (novo txid) e tenta de novo (2 ou 3 ciclos)
 */
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

  cobCycles?: number; // quantas vezes podemos “trocar o txid”
  cobActivatableBudgetMs?: number;

  recAttempts?: number;
  recBudgetMs?: number;
}) {
  const expSeconds = 3600;

  const cobCycles = params.cobCycles ?? 3;
  const cobActivatableBudgetMs = params.cobActivatableBudgetMs ?? 25_000;

  const recAttempts = params.recAttempts ?? 8;
  const recBudgetMs = params.recBudgetMs ?? 25_000;

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

    // 1) locrec
    const locrec = await pixAutoClient.locrec.create();
    lastLocrec = { id: locrec.id, location: locrec.location ?? null };

    // 2) cob (PUT)
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
      cobCycles,
      txid,
      locId: locrec.id,
    });

    // 3) aguarda o txid ficar “ativável” para o /rec
    await waitCobActivatableForRec(txid, cobActivatableBudgetMs);

    // 4) tenta criar rec com esse txid
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

    // Se chegou aqui: estourou budget/tentativas com "txid-not-active" (ou simplesmente não convergiu)
    // -> próximo ciclo cria novo txid
    log("warn", "[EFI J3] rec did not converge; rotating txid", {
      cycle,
      cobCycles,
      txid,
      note: "creating a new cob/txid",
    });
  }

  throw new AppError(
    "Falha ao criar recorrência: Efí não aceitou o txid como ATIVA no /v2/rec mesmo após rotação de txid.",
    502,
    "EFI_REC_CREATE_BUDGET_EXCEEDED",
    {
      note: "rotated-txid-exhausted",
      lastTxid: String(lastCob?.txid ?? ""),
      lastCobStatus: String(lastCob?.status ?? ""),
      lastLocId: lastLocrec?.id ?? null,
    },
  );
}

export async function createEnrollmentAndStartJourney3UseCase(
  input: Input,
): Promise<Output> {
  const pixKey = assertEnv("EFI_PIX_KEY");

  const immediateAmount = normalizeMoney(input.immediateAmount);
  const recurringAmount = normalizeMoney(input.recurringAmount);

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

  // Se confirmado, retorna o que já existe
  if (enrollment.status === "CONFIRMED") {
    const attempt = await prisma.initialPaymentAttempt.findUnique({
      where: { enrollmentId: enrollment.id },
      select: { txid: true, payload: true },
    });

    const rec = await prisma.pixAutoRecurrence.findFirst({
      where: { eventId: input.eventId, participantId: input.participantId },
      orderBy: { createdAt: "desc" },
      select: { idRec: true, pixCopiaECola: true },
    });

    return {
      enrollmentId: enrollment.id,
      txid: attempt?.txid ?? "",
      cobPixCopiaECola: extractCobPixFromAttemptPayload(attempt?.payload),
      idRec: rec?.idRec ?? null,
      recPixCopiaECola: rec?.pixCopiaECola ?? null,
    };
  }

  // Idempotência por contrato (regra Efí)
  const existingByContrato = await prisma.pixAutoRecurrence.findFirst({
    where: { contrato, status: { in: ["CRIADA", "APROVADA"] } },
    orderBy: { createdAt: "desc" },
    select: { idRec: true },
  });

  if (existingByContrato?.idRec) {
    const recFull = await pixAutoClient.rec.get(existingByContrato.idRec);
    return {
      enrollmentId: enrollment.id,
      txid: "",
      cobPixCopiaECola: null,
      idRec: existingByContrato.idRec,
      recPixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
    };
  }

  // idempotency key do plano (não depende de txid)
  const paymentIdempotencyKey = sha256(
    [
      enrollment.id,
      immediateAmount,
      recurringAmount,
      input.periodicidade,
      input.dataInicial,
      input.dataFinal ?? "",
      contrato,
      input.objeto ?? "",
    ].join("|"),
  );

  const existingAttempt = await prisma.initialPaymentAttempt.findUnique({
    where: { enrollmentId: enrollment.id },
    select: {
      id: true,
      payload: true,
      idempotencyKey: true,
      paidAt: true,
    },
  });

  let txidRevision = getTxidRevision(existingAttempt?.payload);

  const planChanged =
    existingAttempt &&
    !existingAttempt.paidAt &&
    existingAttempt.idempotencyKey &&
    existingAttempt.idempotencyKey !== paymentIdempotencyKey;

  if (planChanged) txidRevision += 1;

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
            recurringAmount,
          },
        }),
      },
    });
  };

  // ===== Jornada 3 com fallback de rotação de txid =====
  const solicitacaoPagador = input.solicitacaoPagador ?? "Pagamento inicial";

  const { txid, cob, locrec, rec, recGet } = await startEfiJourney3WithFallback(
    {
      pixKey,
      participant: { cpf: participant.cpf, fullName: participant.fullName },
      immediateAmount,
      recurringAmount,
      contrato,
      objeto: input.objeto ?? null,
      periodicidade: input.periodicidade,
      dataInicial: input.dataInicial,
      dataFinal: input.dataFinal,
      solicitacaoPagador,

      cobCycles: 3,
      cobActivatableBudgetMs: 25_000,

      recAttempts: 8,
      recBudgetMs: 25_000,
    },
  );
  console.log("🚀 ~ createEnrollmentAndStartJourney3UseCase ~ recGet:", recGet);
  console.log("🚀 ~ createEnrollmentAndStartJourney3UseCase ~ rec:", rec);
  console.log("🚀 ~ createEnrollmentAndStartJourney3UseCase ~ locrec:", locrec);
  console.log("🚀 ~ createEnrollmentAndStartJourney3UseCase ~ cob:", cob);
  console.log("🚀 ~ createEnrollmentAndStartJourney3UseCase ~ txid:", txid);

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
        recurringAmount,
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
        valorRec: recurringAmount,
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
        valorRec: recurringAmount,
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
          createdFrom: "journey3/enroll",
          activationTxid: txid,
          locrec,
          rec,
          recGet,
        }),
      },
    });
  });

  log("info", "Enrollment journey3 started", {
    enrollmentId: enrollment.id,
    txid,
    idRec: rec.idRec,
  });

  return {
    enrollmentId: enrollment.id,
    txid,
    // Em Jornada 3, o QR Code de ativação da recorrência já engloba o valor da cobrança inicial.
    // Exibir o QR da cob (cob.pixCopiaECola) é um erro comum que deixa a recorrência orfã.
    cobPixCopiaECola:
      recGet.dadosQR?.pixCopiaECola || cob.pixCopiaECola || null,
    idRec: rec.idRec,
    recPixCopiaECola: recGet.dadosQR?.pixCopiaECola || null,
  };
}
