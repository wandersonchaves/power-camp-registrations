// src/use-cases/pix-auto/create-recurrence.use-case.ts
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Input = {
  eventId: string;
  participantId: string;

  contrato: string;
  objeto?: string;

  dataInicial: string; // YYYY-MM-DD
  dataFinal?: string; // YYYY-MM-DD
  periodicidade: string;
  valorRec: string;

  // Jornada 2/3/4: se você já tiver locrec
  locId?: number;

  // Jornada 3/4: se precisar atrelar txid de cobrança imediata/cobv
  ativacaoTxid?: string;
};

function normalizeMoney(value: string): string {
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError("Invalid amount", 400, "INVALID_AMOUNT");
  }
  return n.toFixed(2);
}

function assertDateYYYYMMDD(v: string, field: string) {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new AppError(`${field} must be YYYY-MM-DD`, 400, "INVALID_DATE");
  }
  return s;
}

export async function createRecurrenceUseCase(input: Input) {
  const eventId = String(input.eventId ?? "").trim();
  const participantId = String(input.participantId ?? "").trim();
  const contrato = String(input.contrato ?? "").trim();

  if (!eventId)
    throw new AppError("eventId is required", 400, "EVENT_ID_REQUIRED");
  if (!participantId)
    throw new AppError(
      "participantId is required",
      400,
      "PARTICIPANT_ID_REQUIRED",
    );
  if (!contrato)
    throw new AppError("contrato is required", 400, "CONTRATO_REQUIRED");

  const dataInicial = assertDateYYYYMMDD(input.dataInicial, "dataInicial");
  const dataFinal = input.dataFinal
    ? assertDateYYYYMMDD(input.dataFinal, "dataFinal")
    : undefined;

  const valorRec = normalizeMoney(input.valorRec);
  const periodicidade = String(input.periodicidade ?? "").trim();
  if (!periodicidade)
    throw new AppError(
      "periodicidade is required",
      400,
      "PERIODICIDADE_REQUIRED",
    );

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true, cpf: true, fullName: true },
  });
  if (!participant) {
    throw new AppError("Participant not found", 404, "PARTICIPANT_NOT_FOUND");
  }

  const idempotencyKey = sha256(
    [
      "REC",
      eventId,
      participantId,
      participant.cpf,
      contrato,
      dataInicial,
      dataFinal ?? "",
      periodicidade,
      valorRec,
      input.locId ?? "",
      input.ativacaoTxid ?? "",
      input.objeto ?? "",
    ].join("|"),
  );

  const existing = await prisma.pixAutoRecurrence.findUnique({
    where: { idempotencyKey },
  });
  if (existing?.idRec) return existing;

  const body = {
    vinculo: {
      contrato,
      devedor: { cpf: participant.cpf, nome: participant.fullName },
      ...(input.objeto ? { objeto: input.objeto } : {}),
    },
    calendario: {
      dataInicial,
      ...(dataFinal ? { dataFinal } : {}),
      periodicidade,
    },
    valor: { valorRec },
    politicaRetentativa: "NAO_PERMITE" as const,
    ...(input.locId ? { loc: input.locId } : {}),
    ...(input.ativacaoTxid
      ? { ativacao: { dadosJornada: { txid: input.ativacaoTxid } } }
      : {}),
  };

  // placeholder (evita race)
  const draft = await prisma.pixAutoRecurrence.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      idempotencyKey,
      eventId,
      participantId,
      status: "CREATING",
      valorRec,
      periodicidade,
      dataInicial: new Date(`${dataInicial}T00:00:00.000Z`),
      dataFinal: dataFinal ? new Date(`${dataFinal}T00:00:00.000Z`) : null,
      contrato,
      objeto: input.objeto ?? null,
      locId: input.locId ?? null,
      jornada: null,
      locationUrl: null,
      pixCopiaECola: null,
      payload: asInputJson({ body }),
    },
  });

  const resp = await pixAutoClient.rec.create(body);

  // Busca QR (quando aplicável) — o client já lida com query txid quando precisar
  const full = await pixAutoClient.rec.get(
    resp.idRec,
    input.ativacaoTxid ? { txid: input.ativacaoTxid } : undefined,
  );

  return prisma.pixAutoRecurrence.update({
    where: { id: draft.id },
    data: {
      idRec: resp.idRec,
      status: String(full.status ?? resp.status ?? "CRIADA"),
      locId: full.loc?.id ?? draft.locId,
      locationUrl: full.loc?.location ?? draft.locationUrl,
      jornada: full.dadosQR?.jornada ?? draft.jornada,
      pixCopiaECola: full.dadosQR?.pixCopiaECola ?? draft.pixCopiaECola,
      payload: asInputJson({ body, resp, full }),
    },
  });
}
