// src/use-cases/enrollment/create-enrollment-and-start-journey3.use-case.ts
import type { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { waitForCobActive } from "@/infra/efi/wait-for-cob-active";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";
import { buildTxid } from "@/lib/txid";

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
  dataFinal?: string;

  solicitacaoPagador?: string;
};

type Output = {
  enrollmentId: string;
  txid: string;
  cobPixCopiaECola: string | null;
  idRec: string | null;
  recPixCopiaECola: string | null;
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

function mapCobStatus(status: string | null | undefined) {
  if (!status) return "CREATED";
  const s = status.toUpperCase();
  if (s.includes("CONCLUID") || s.includes("LIQ") || s.includes("PAGA"))
    return "PAID";
  if (s.includes("CANCEL")) return "CANCELLED";
  if (s.includes("EXPIR")) return "EXPIRED";
  if (s.includes("ATIV")) return "ACTIVE";
  return "CREATED";
}

/**
 * Para evitar colisão e permitir retry por expiração, usamos:
 * txidBase (determinístico) + sufixo curto de revisão.
 * Mantém <= 35 chars.
 */
function buildTxidWithRevision(baseTxid: string, rev: number) {
  const r = Math.max(0, rev);
  const rev2 = String(r % 100).padStart(2, "0");
  const h6 = sha256(`${baseTxid}:${r}`).slice(0, 6);
  const suffix = `${h6}${rev2}`; // 8
  const headLen = Math.max(1, 35 - suffix.length);
  return `${baseTxid.slice(0, headLen)}${suffix}`;
}

type AttemptTicketPayload = {
  txidRevision?: number;
};

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

  // ✅ se usuário informou exatamente 8 dígitos, usa (padrão do exemplo Efí)
  if (/^\d{8}$/.test(digits)) return digits;

  const seed = `${params.eventId}|${params.participantId}|${params.enrollmentId}`;
  const h = sha256(seed); // hex

  // hex tem letras; extraímos dígitos se houver
  const onlyDigits = h.replace(/\D/g, "");

  // fallback sem spread (compatível com target antigo)
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);

  const safeDigits =
    onlyDigits.length >= 12 ? onlyDigits : String(sum).repeat(5);

  // 8 dígitos finais (sempre retorna algo)
  return safeDigits.slice(-8).padStart(8, "7");
}

function computeCobExpiresAtMs(cob: {
  calendario?: { criacao?: string; expiracao?: number };
}): number | null {
  const created = cob.calendario?.criacao;
  const expSec = cob.calendario?.expiracao;

  if (!created || !expSec || !Number.isFinite(expSec)) return null;

  const createdMs = Date.parse(created);
  if (!Number.isFinite(createdMs)) return null;

  return createdMs + expSec * 1000;
}

/**
 * ✅ Jornada 3 (EFI):
 * 1) POST /v2/locrec
 * 2) PUT /v2/cob/:txid  (ou POST /v2/cob)
 * 3) POST /v2/rec  (loc = cob.loc.id) + ativacao.dadosJornada.txid
 * 4) GET /v2/rec/:idRec?txid=...
 *
 * Robustez:
 * - se /v2/rec disser que txid expirou -> rev++ -> novo txid -> recria COB -> tenta rec novamente (1 retry)
 * - se contrato já tem recorrência ativa -> 409 (idempotência por contrato)
 */
export async function createEnrollmentAndStartJourney3UseCase(
  input: Input,
): Promise<Output> {
  assertEnv("EFI_PIX_KEY");

  const immediateAmount = normalizeMoney(input.immediateAmount);
  const recurringAmount = normalizeMoney(input.recurringAmount);

  // 1) validações mínimas
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

  // 2) enrollment idempotente
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

  // ✅ contrato Efí: usa o informado se for numérico válido; senão gera determinístico
  const contrato = makeContratoEfi({
    inputContrato: input.contrato,
    enrollmentId: enrollment.id,
    participantId: input.participantId,
    eventId: input.eventId,
  });

  // 3) se confirmado, retorna dados existentes
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

    let cobPix: string | null = null;
    if (attempt?.payload && isJsonObject(attempt.payload)) {
      const cobPayload = attempt.payload["cob"];
      if (
        cobPayload &&
        typeof cobPayload === "object" &&
        !Array.isArray(cobPayload)
      ) {
        const pix = (cobPayload as Record<string, unknown>)["pixCopiaECola"];
        if (typeof pix === "string") cobPix = pix;
      }
    }

    return {
      enrollmentId: enrollment.id,
      txid: attempt?.txid ?? "",
      cobPixCopiaECola: cobPix,
      idRec: rec?.idRec ?? null,
      recPixCopiaECola: rec?.pixCopiaECola ?? null,
    };
  }

  /**
   * ✅ 3.1) Idempotência por contrato (regra Efí)
   * Se já existe recorrência ativa para esse contrato, não tente criar outra.
   */
  const existingByContrato = await prisma.pixAutoRecurrence.findFirst({
    where: {
      contrato,
      status: { in: ["CRIADA", "APROVADA"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      idRec: true,
      pixCopiaECola: true,
      status: true,
      eventId: true,
      participantId: true,
    },
  });

  // 4) idempotency key do plano
  const paymentIdempotencyKey = sha256(
    [
      enrollment.id,
      immediateAmount,
      recurringAmount,
      input.periodicidade,
      input.dataInicial,
      input.dataFinal ?? "",
      contrato,
    ].join("|"),
  );

  // txid base determinístico
  const txidBase = buildTxid({
    eventId: input.eventId,
    kind: "COB_IMMEDIATE",
    enrollmentId: enrollment.id,
    participantId: input.participantId,
  });

  /**
   * 5) Attempt idempotente por enrollmentId
   *    IMPORTANTE: não zere payload a cada chamada (pra manter txidRevision).
   */
  const existingAttempt = await prisma.initialPaymentAttempt.findUnique({
    where: { enrollmentId: enrollment.id },
    select: { id: true, txid: true, payload: true },
  });

  const currentRev = getTxidRevision(existingAttempt?.payload);
  const initialTxid = existingAttempt?.txid?.length
    ? existingAttempt.txid
    : buildTxidWithRevision(txidBase, currentRev);

  const attempt = await prisma.initialPaymentAttempt.upsert({
    where: { enrollmentId: enrollment.id },
    update: {
      idempotencyKey: paymentIdempotencyKey,
      amount: immediateAmount,
      txid: initialTxid,
    },
    create: {
      enrollmentId: enrollment.id,
      idempotencyKey: paymentIdempotencyKey,
      txid: initialTxid,
      status: "CREATED",
      amount: immediateAmount,
      payload: asInputJson({
        ticket: { txidRevision: currentRev } satisfies AttemptTicketPayload,
      }),
    },
    select: { id: true, txid: true, payload: true },
  });

  let effectiveTxid = attempt.txid;
  let txidRevision = getTxidRevision(attempt.payload);

  if (existingByContrato) {
    // ✅ Reusa a recorrência existente em vez de tentar criar outra (Efí bloqueia)
    // Se o objetivo aqui for "gerar nova inscrição", você deve decidir:
    // - reutilizar idRec/pixCopiaECola
    // - e eventualmente criar NOVA COB imediata (novo txid) se quiser cobrar de novo agora.

    // (A) garante uma COB imediata ativa para este novo enrollment/tentativa
    const cob = await pixAutoClient.journey3.getOrCreateCobImmediate({
      txid: effectiveTxid,
      valor: immediateAmount,
      solicitacaoPagador:
        input.solicitacaoPagador ?? "PowerCamp 2027 - pagamento inicial",
    });

    await waitForCobActive(effectiveTxid);

    const cobFull = cob.pixCopiaECola
      ? cob
      : await pixAutoClient.cob.get(effectiveTxid);

    const idRec = existingByContrato.idRec;

    if (!idRec) {
      throw new AppError(
        "Recorrência encontrada localmente sem idRec válido.",
        500,
        "EFI_REC_MISSING_IDREC",
        existingByContrato,
      );
    }

    const recFull = await pixAutoClient.rec.get(idRec, {
      txid: effectiveTxid,
    });
    // (C) persiste attempt e retorna sem criar nova rec
    await prisma.initialPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        txid: effectiveTxid,
        status: mapCobStatus(cobFull.status),
        createdAtEfi: cobFull.calendario?.criacao
          ? new Date(cobFull.calendario.criacao)
          : null,
        payload: asInputJson({
          ticket: {
            immediateAmount,
            recurringAmount,
            periodicidade: input.periodicidade,
            dataInicial: input.dataInicial,
            dataFinal: input.dataFinal ?? null,
            contrato,
            objeto: input.objeto ?? null,
            teamCode: input.teamCode ?? null,
            txidRevision,
            reusedRec: true,
            reusedIdRec: existingByContrato.idRec,
          },
          cob: cobFull,
          recGet: recFull,
        }),
      },
    });

    return {
      enrollmentId: enrollment.id,
      txid: effectiveTxid,
      cobPixCopiaECola: cobFull.pixCopiaECola ?? null,
      idRec: existingByContrato.idRec,
      recPixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
    };
  }

  // Passo 1) locrec — deve ser único por recorrência
  let locrec = await pixAutoClient.locrec.create();

  const ensureCobActive = async (txid: string) => {
    const cob = await pixAutoClient.journey3.getOrCreateCobImmediate({
      txid,
      valor: immediateAmount,
      solicitacaoPagador:
        input.solicitacaoPagador ?? "PowerCamp 2027 - pagamento inicial",
    });

    await waitForCobActive(txid);

    // pega pixCopiaECola com consistência
    if (cob.pixCopiaECola) return cob;
    return pixAutoClient.cob.get(txid);
  };

  // Passo 2) cob ATIVA
  let cob = await ensureCobActive(effectiveTxid);

  const createRec = async (txid: string, locId: number) => {
    return pixAutoClient.rec.create({
      vinculo: {
        contrato, // <- contrato normalizado/gerado (como você já ajustou)
        devedor: { cpf: participant.cpf, nome: participant.fullName },
        objeto: input.objeto ?? undefined,
      },
      calendario: {
        dataInicial: input.dataInicial,
        dataFinal: input.dataFinal ?? undefined,
        periodicidade: input.periodicidade,
      },
      valor: { valorRec: recurringAmount },
      politicaRetentativa: "NAO_PERMITE",
      loc: locId, // ✅ Jornada 3: loc = locrec.id
      ativacao: { dadosJornada: { txid } },
    });
  };

  // Passo 3) rec (com retry para txid expirada E loc já usado)
  let rec: { idRec: string };

  try {
    rec = await createRec(effectiveTxid, locrec.id);
  } catch (err) {
    // ✅ loc já usado -> cria novo locrec e tenta novamente 1x
    if (pixAutoClient.errors.isRecLocAlreadyUsed(err)) {
      locrec = await pixAutoClient.locrec.create();
      rec = await createRec(effectiveTxid, locrec.id);
    } else if (pixAutoClient.errors.isContratoAlreadyHasActiveRecurrence(err)) {
      throw new AppError(
        "Contrato já possui recorrência ativa na Efí. Use outro contrato ou cancele a recorrência existente.",
        409,
        "EFI_REC_CONTRATO_ALREADY_ACTIVE",
        err,
      );
    } else if (pixAutoClient.errors.isRecTxidExpired(err)) {
      // ✅ txid expirada -> rotaciona txid -> recria COB -> tenta /rec mais 1x (com locrec NOVO)
      txidRevision += 1;
      const rotatedTxid = buildTxidWithRevision(txidBase, txidRevision);

      const prev =
        attempt.payload && isJsonObject(attempt.payload) ? attempt.payload : {};
      const prevTicket =
        prev["ticket"] &&
        typeof prev["ticket"] === "object" &&
        !Array.isArray(prev["ticket"])
          ? (prev["ticket"] as Record<string, unknown>)
          : {};

      await prisma.initialPaymentAttempt.update({
        where: { id: attempt.id },
        data: {
          txid: rotatedTxid,
          payload: asInputJson({
            ...prev,
            ticket: {
              ...prevTicket,
              txidRevision,
            } satisfies AttemptTicketPayload,
          }),
        },
      });

      effectiveTxid = rotatedTxid;

      // novo cob
      cob = await ensureCobActive(effectiveTxid);

      // ✅ novo locrec sempre (evita reuse)
      locrec = await pixAutoClient.locrec.create();

      rec = await createRec(effectiveTxid, locrec.id);
    } else {
      throw err;
    }
  }

  // Passo 4) GET rec/:idRec?txid=...
  const cobExpiresAtMs = computeCobExpiresAtMs(cob);
  const nowMs = Date.now();

  // ✅ só envia txid se ainda estiver dentro da validade (com folga)
  const shouldSendTxid =
    cobExpiresAtMs !== null ? nowMs < cobExpiresAtMs - 30_000 : true;

  const recFull = await pixAutoClient.rec.get(rec.idRec, {
    txid: shouldSendTxid ? effectiveTxid : undefined,
  });

  // Persistência atômica
  await prisma.$transaction(async (tx) => {
    await tx.initialPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        txid: effectiveTxid,
        status: mapCobStatus(cob.status),
        createdAtEfi: cob.calendario?.criacao
          ? new Date(cob.calendario.criacao)
          : null,
        payload: asInputJson({
          ticket: {
            immediateAmount,
            recurringAmount,
            periodicidade: input.periodicidade,
            dataInicial: input.dataInicial,
            dataFinal: input.dataFinal ?? null,
            contrato,
            objeto: input.objeto ?? null,
            teamCode: input.teamCode ?? null,
            txidRevision,
          },
          locrec, // mantemos por rastreabilidade
          cob,
          rec,
          recGet: recFull,
        }),
      },
    });

    const recIdempotencyKey = sha256(
      ["REC", enrollment.id, effectiveTxid].join("|"),
    );

    // locId correto preferencialmente da COB
    const effectiveLocId = locrec.id;
    const effectiveLocationUrl = locrec.location;

    await tx.pixAutoRecurrence.upsert({
      where: { idempotencyKey: recIdempotencyKey },
      update: {
        idRec: rec.idRec,
        status: recFull.status ?? "CRIADA",
        locId: effectiveLocId,
        locationUrl: effectiveLocationUrl,
        jornada: recFull.dadosQR?.jornada ?? null,
        pixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
        valorRec: recurringAmount,
        periodicidade: input.periodicidade,
        dataInicial: new Date(`${input.dataInicial}T00:00:00.000Z`),
        dataFinal: input.dataFinal
          ? new Date(`${input.dataFinal}T00:00:00.000Z`)
          : null,
        contrato,
        objeto: input.objeto ?? null,
      },
      create: {
        idempotencyKey: recIdempotencyKey,
        eventId: input.eventId,
        participantId: input.participantId,
        idRec: rec.idRec,
        status: recFull.status ?? "CRIADA",
        valorRec: recurringAmount,
        periodicidade: input.periodicidade,
        dataInicial: new Date(`${input.dataInicial}T00:00:00.000Z`),
        dataFinal: input.dataFinal
          ? new Date(`${input.dataFinal}T00:00:00.000Z`)
          : null,
        contrato,
        objeto: input.objeto ?? null,
        locId: effectiveLocId,
        locationUrl: effectiveLocationUrl,
        jornada: recFull.dadosQR?.jornada ?? null,
        pixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
      },
    });
  });

  log("info", "Enrollment journey3 started", {
    enrollmentId: enrollment.id,
    txid: effectiveTxid,
    idRec: rec.idRec,
  });

  return {
    enrollmentId: enrollment.id,
    txid: effectiveTxid,
    cobPixCopiaECola: cob.pixCopiaECola ?? null,
    idRec: rec.idRec,
    recPixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
  };
}
