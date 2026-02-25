// src/use-cases/enrollment/create-enrollment-and-start-journey3.use-case.ts
import type { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import type { CobResponse } from "@/infra/efi/pix-auto.types";
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

/**
 * Contrato Efí: 8 dígitos.
 * Se input já for 8 dígitos, usa.
 * Senão, gera determinístico com hash (e garante 8 dígitos).
 */
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
 * Gate curto e dedupado:
 * - Não confirma ATIVA (no fluxo puro), apenas dá tempo de consistência eventual.
 * - Evita muitos sleeps e logs repetidos.
 */
async function waitCobPropagationGate(txid: string) {
  await waitForCobActive(txid, {
    label: "[EFI COB] propagation",
    maxAttempts: 3,
    baseDelayMs: 200,
    maxDelayMs: 900,
    maxTotalMs: 3500,
    dedupeTtlMs: 10_000,
    acceptPaidAsUsable: false, // compat (ignorado)
  });
}

/**
 * Jornada 3 “pura” (locrec -> cob -> rec -> rec.get)
 * - inclui abort cedo (COB CONCLUIDA/EXPIRADA/etc)
 * - inclui retries com budget + tratamento de 500
 * - usa cob.getCached() apenas quando “txid not active”
 */
// src/use-cases/enrollment/create-enrollment-and-start-journey3.use-case.ts
async function startEfiJourney3Pure(params: {
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

  // budgets/retries
  recBudgetMs?: number;
  maxRecAttempts?: number;

  // opcional: tempo máximo para COB virar ATIVA (consistência eventual)
  cobActiveBudgetMs?: number;
}) {
  const expSeconds = 3600;

  const maxRecAttempts = params.maxRecAttempts ?? 6;
  const recBudgetMs = params.recBudgetMs ?? 12_000;

  const cobActiveBudgetMs = params.cobActiveBudgetMs ?? 18_000;

  const nowIso = () => new Date().toISOString();

  async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Aguarda a COB ficar ATIVA (ou falha cedo se entrar em status terminal).
   * Isso evita “martelar” /v2/rec enquanto o txid ainda não propagou.
   */
  async function waitUntilCobActive(txid: string) {
    const start = Date.now();
    let attempt = 0;

    while (Date.now() - start < cobActiveBudgetMs) {
      attempt += 1;

      const cobNow = await pixAutoClient.cob.getCached(txid, {
        dedupeTtlMs: 1200,
      });

      if (pixAutoClient.errors.cob.isTerminalNotUsableStatus(cobNow.status)) {
        throw new AppError(
          `A cobrança (txid) está ${String(
            cobNow.status,
          )} e não pode ser usada para ativação na Jornada 3.
Crie uma nova cobrança e NÃO efetue o pagamento antes de criar a recorrência.
(Em homologação, valores até R$10 podem concluir automaticamente.)`,
          409,
          "EFI_J3_TXID_NOT_USABLE",
          { txid, cobStatus: cobNow.status },
        );
      }

      const status = String(cobNow.status ?? "").toUpperCase();
      if (status === "ATIVA") return;

      const backoffMs =
        Math.min(2600, 250 + attempt * 380) + Math.floor(Math.random() * 220);

      log("info", "[EFI COB] wait-until-active", {
        ts: nowIso(),
        txid,
        attempt,
        cobStatus: cobNow.status,
        sleepMs: backoffMs,
      });

      await sleep(backoffMs);
    }

    throw new AppError(
      "A cobrança (txid) não ficou ATIVA dentro do tempo limite para ativação da Jornada 3.",
      502,
      "EFI_J3_COB_NOT_ACTIVE_TIMEOUT",
      { txid, budgetMs: cobActiveBudgetMs },
    );
  }

  // 1) locrec
  let locrec = await pixAutoClient.locrec.create();

  // 2) cob
  const cob = await pixAutoClient.cob.create({
    calendario: { expiracao: expSeconds },
    devedor: { cpf: params.participant.cpf, nome: params.participant.fullName },
    valor: { original: params.immediateAmount },
    chave: params.pixKey,
    ...(params.solicitacaoPagador
      ? { solicitacaoPagador: params.solicitacaoPagador }
      : {}),
  });

  const txid = String(cob.txid ?? "").trim();
  if (!txid) {
    throw new AppError(
      "EFI não retornou txid ao criar COB.",
      502,
      "EFI_COB_MISSING_TXID",
      cob,
    );
  }

  // Fail-fast se a própria resposta já veio em status terminal
  if (pixAutoClient.errors.cob.isTerminalNotUsableStatus(cob.status)) {
    throw new AppError(
      `A cobrança (txid) está ${String(
        cob.status,
      )}. O endpoint /v2/rec exige txid ATIVA para ativação na Jornada 3.
Crie uma nova cobrança e NÃO efetue o pagamento antes de criar a recorrência.
(Em homologação, valores até R$10 podem concluir automaticamente.)`,
      409,
      "EFI_J3_TXID_NOT_USABLE",
      { txid, cobStatus: cob.status },
    );
  }

  // 3) Gate por condição: espera a COB ficar ATIVA (melhor prática vs só sleep)
  await waitUntilCobActive(txid);

  // 4) propagation gate curto extra (mantém seu comportamento existente, mas agora é redundância leve)
  await waitCobPropagationGate(txid);

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

  const start = Date.now();
  let rec: { idRec: string } | null = null;

  // “circuit breaker” simples para 5xx
  let serverErrorStreak = 0;

  for (let attemptN = 1; attemptN <= maxRecAttempts; attemptN++) {
    if (Date.now() - start > recBudgetMs) break;

    try {
      rec = await pixAutoClient.rec.create({
        ...recBodyBase,
        loc: locrec.id,
        ativacao: { dadosJornada: { txid } },
      });
      break;
    } catch (err) {
      // locrec reutilizado
      if (pixAutoClient.errors.isRecLocAlreadyUsed(err)) {
        locrec = await pixAutoClient.locrec.create();
        continue;
      }

      // txid não está ativa no /rec (consistência eventual entre serviços)
      if (pixAutoClient.errors.isRecActivationTxidNotActive(err)) {
        const cobNow = await pixAutoClient.cob.getCached(txid, {
          dedupeTtlMs: 1200,
        });

        if (pixAutoClient.errors.cob.isTerminalNotUsableStatus(cobNow.status)) {
          throw new AppError(
            `A cobrança (txid) ficou ${String(
              cobNow.status,
            )} enquanto tentávamos criar a recorrência.
O /v2/rec exige txid ATIVA. Gere uma nova Jornada 3 e crie a recorrência antes do pagamento.`,
            409,
            "EFI_J3_TXID_BECAME_NOT_USABLE",
            { txid, cobStatus: cobNow.status },
          );
        }

        // Backoff + gate dedupado (não “martela”)
        const backoffMs =
          Math.min(3200, 450 + attemptN * 520) +
          Math.floor(Math.random() * 220);

        log("info", "[EFI REC] txid-not-active backoff", {
          ts: nowIso(),
          txid,
          attempt: attemptN,
          cobStatus: cobNow.status,
          sleepMs: backoffMs,
        });

        await waitForCobActive(txid, {
          label: "[EFI REC] txid-not-active backoff",
          maxAttempts: 1,
          baseDelayMs: backoffMs,
          maxDelayMs: backoffMs,
          multiplier: 1.0,
          jitterMs: 0,
          quiet: true,
          maxTotalMs: backoffMs + 25,
          dedupeTtlMs: Math.min(1500, backoffMs),
          acceptPaidAsUsable: false, // compat (ignorado)
        });

        serverErrorStreak = 0;
        continue;
      }

      // 5xx ao criar recorrência
      if (pixAutoClient.errors.isRecInternalServerError(err)) {
        serverErrorStreak += 1;

        if (serverErrorStreak >= 2) {
          throw new AppError(
            "Efí retornou erro interno (5xx) ao criar recorrência repetidamente. Tente novamente em instantes (evita martelar o PSP).",
            502,
            "EFI_REC_SERVER_ERROR",
            { txid, streak: serverErrorStreak },
          );
        }

        const backoffMs =
          Math.min(2400, 500 + attemptN * 550) +
          Math.floor(Math.random() * 260);

        log("warn", "[EFI REC] server-error backoff", {
          ts: nowIso(),
          txid,
          attempt: attemptN,
          sleepMs: backoffMs,
        });

        await sleep(backoffMs);
        continue;
      }

      // Contrato já tem recorrência ativa
      if (pixAutoClient.errors.isContratoAlreadyHasActiveRecurrence(err)) {
        throw new AppError(
          "Contrato já possui recorrência ativa na Efí. Use outro contrato ou cancele a recorrência existente.",
          409,
          "EFI_REC_CONTRATO_ALREADY_ACTIVE",
          err,
        );
      }

      // txid expirou
      if (pixAutoClient.errors.isRecTxidExpired(err)) {
        throw new AppError(
          "A cobrança imediata (txid) expirou durante a criação da recorrência. Inicie uma nova Jornada 3.",
          409,
          "EFI_J3_TXID_EXPIRED",
          { txid },
        );
      }

      throw err;
    }
  }

  if (!rec?.idRec) {
    const cobNow = await pixAutoClient.cob.getCached(txid, {
      dedupeTtlMs: 1200,
    });

    throw new AppError(
      "Falha ao criar recorrência: budget atingido ou a Efí não aceitou o txid como ATIVA no /v2/rec.",
      502,
      "EFI_REC_CREATE_BUDGET_EXCEEDED",
      {
        txid,
        locId: locrec.id,
        recBudgetMs,
        maxRecAttempts,
        cobStatus: cobNow.status,
      },
    );
  }

  // 5) rec.get
  const recGet = await pixAutoClient.rec.get(rec.idRec, { txid });

  return { txid, cob, locrec, rec, recGet };
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

  // ===== Jornada 3 “pura” consolidada =====
  const solicitacaoPagador = input.solicitacaoPagador ?? "Pagamento inicial";

  const { txid, cob, locrec, rec, recGet } = await startEfiJourney3Pure({
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
    recBudgetMs: 12_000,
    maxRecAttempts: 6,
  });

  await persistAttempt({ txid, cob, locrec, rec, recGet });

  // Persistência da recorrência (transação curta)
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
    cobPixCopiaECola: cob.pixCopiaECola ?? null,
    idRec: rec.idRec,
    recPixCopiaECola: recGet.dadosQR?.pixCopiaECola ?? null,
  };
}
