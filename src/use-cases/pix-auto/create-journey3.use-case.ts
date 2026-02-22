// src/use-cases/pix-auto/create-journey3.use-case.ts
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { waitForCobActive } from "@/infra/efi/wait-for-cob-active";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Input = {
  eventId: string;
  participantId: string;

  // cobrança imediata (primeiro pagamento)
  immediateAmount: string; // "106.07"
  // se você quiser controlar o txid do cob imediato via PUT, passe aqui
  immediateTxid?: string;

  // recorrência
  contrato: string;
  objeto?: string;
  periodicidade: string; // "MENSAL"
  dataInicial: string; // "2026-02-22"
  dataFinal?: string;
  valorRec: string;

  // opcional (se quiser mandar campos extras do cob)
  solicitacaoPagador?: string;
};

function normalizeMoney(value: string): string {
  const raw = String(value).trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0)
    throw new AppError("Invalid amount", 400, "INVALID_AMOUNT");
  return n.toFixed(2);
}

function envNumber(name: string, fallback: number) {
  const raw = String(process.env[name] ?? "").trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function createJourney3UseCase(input: Input) {
  const participant = await prisma.participant.findUnique({
    where: { id: input.participantId },
    select: { id: true, cpf: true, fullName: true },
  });

  if (!participant) {
    throw new AppError("Participant not found", 404, "PARTICIPANT_NOT_FOUND");
  }

  const immediateAmount = normalizeMoney(input.immediateAmount);
  const valorRec = normalizeMoney(input.valorRec);

  // Idempotência do fluxo Jornada 3 (evita duplicar tudo)
  const idempotencyKey = sha256(
    [
      input.eventId,
      input.participantId,
      participant.cpf,
      immediateAmount,
      input.immediateTxid ?? "POST",
      input.contrato,
      input.dataInicial,
      input.dataFinal ?? "",
      input.periodicidade,
      valorRec,
    ].join("|"),
  );

  // Se já existe recorrência com esta chave, retorna
  const existingRec = await prisma.pixAutoRecurrence.findUnique({
    where: { idempotencyKey },
  });

  if (existingRec?.idRec) {
    // Se já tem pixCopiaECola persistido, ótimo. Se não tiver, quem chama pode fazer refresh usando txidAtivacao salvo no payload.
    return existingRec;
  }

  // 1) locrec (sempre novo para evitar "loc já está sendo utilizado")
  const loc = await pixAutoClient.locrec.create({});

  await prisma.pixAutoLocRec.upsert({
    where: { locId: loc.id },
    update: {},
    create: {
      eventId: input.eventId,
      participantId: input.participantId,
      locId: loc.id,
      locationUrl: loc.location,
      criacao: loc.criacao ? new Date(loc.criacao) : null,
    },
  });

  // 2) COB imediata
  const expSeconds = envNumber("EFI_DEFAULT_COB_EXP_SECONDS", 3600);

  const cobBody = {
    calendario: { expiracao: expSeconds },
    valor: { original: immediateAmount },
    // ⚠️ se sua EFI exigir "chave" aqui, adicione (ex: EFI_PIX_KEY)
    // chave: String(process.env.EFI_PIX_KEY ?? "").trim() || undefined,
    solicitacaoPagador:
      input.solicitacaoPagador ?? `PowerCamp 2027 - pagamento imediato`,
  };

  const cob = input.immediateTxid
    ? await pixAutoClient.cob.put(input.immediateTxid, cobBody)
    : await pixAutoClient.cob.create(cobBody);

  // ✅ txidAtivacao: use SEMPRE este nos passos 3 e 4
  const txidAtivacao = cob.txid;

  // garanta status ATIVA antes de criar o rec (evita inconsistências)
  await waitForCobActive(txidAtivacao);

  // persistir COB imediata (recomendado)
  const cobIdempotencyKey = sha256(
    [input.eventId, input.participantId, txidAtivacao].join("|"),
  );

  await prisma.pixCobImmediate.upsert({
    where: { idempotencyKey: cobIdempotencyKey },
    update: {
      txid: txidAtivacao,
      status: cob.status ?? "CRIADA",
      payload: asInputJson(cob),
    },
    create: {
      eventId: input.eventId,
      participantId: input.participantId,
      idempotencyKey: cobIdempotencyKey,
      txid: txidAtivacao,
      status: cob.status ?? "CRIADA",
      valorOriginal: immediateAmount,
      criadoEm: cob.calendario?.criacao
        ? new Date(cob.calendario.criacao)
        : null,
      payload: asInputJson(cob),
    },
  });

  // 3) cria draft local
  const recDraft = await prisma.pixAutoRecurrence.create({
    data: {
      idempotencyKey,
      eventId: input.eventId,
      participantId: input.participantId,
      status: "CREATING",
      valorRec,
      periodicidade: input.periodicidade,
      dataInicial: new Date(`${input.dataInicial}T00:00:00.000Z`),
      dataFinal: input.dataFinal
        ? new Date(`${input.dataFinal}T00:00:00.000Z`)
        : null,
      contrato: input.contrato,
      objeto: input.objeto ?? null,
      locId: loc.id,
      locationUrl: loc.location,
      jornada: "JORNADA_3",
      payload: asInputJson({
        loc,
        cob,
        txidAtivacao,
      }),
    },
  });

  // 4) POST /v2/rec (loc + ativacao.txid = txidAtivacao)
  const recResp = await pixAutoClient.rec.create({
    vinculo: {
      contrato: input.contrato,
      devedor: { cpf: participant.cpf, nome: participant.fullName },
      objeto: input.objeto ? input.objeto : undefined,
    },
    calendario: {
      dataInicial: input.dataInicial,
      dataFinal: input.dataFinal ? input.dataFinal : undefined,
      periodicidade: input.periodicidade,
    },
    valor: { valorRec },
    politicaRetentativa: "NAO_PERMITE",
    loc: loc.id,
    ativacao: { dadosJornada: { txid: txidAtivacao } },
  });

  // 5) GET /v2/rec/:idRec?txid=txidAtivacao (Jornada 3 copia e cola)
  let recFull;

  try {
    recFull = await pixAutoClient.rec.get(recResp.idRec, {
      txid: txidAtivacao,
    });
  } catch (err) {
    // ✅ usa helper existente
    if (pixAutoClient.errors.isRecTxidExpired(err)) {
      throw new AppError(
        "A cobrança imediata (txid) usada na Jornada 3 expirou antes de obter o QR. Inicie uma nova Jornada 3 (novo loc + nova cob + novo rec).",
        409,
        "EFI_J3_TXID_EXPIRED_BEFORE_QR",
        { idRec: recResp.idRec, txidAtivacao },
      );
    }

    throw err instanceof AppError ? err : err;
  }

  const updated = await prisma.pixAutoRecurrence.update({
    where: { id: recDraft.id },
    data: {
      idRec: recResp.idRec,
      status: recFull.status ?? recResp.status ?? "CRIADA",
      pixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
      jornada: recFull.dadosQR?.jornada ?? "JORNADA_3",
      payload: asInputJson({
        loc,
        cob,
        txidAtivacao,
        recResp,
        recFull,
      }),
    },
  });

  return updated;
}
