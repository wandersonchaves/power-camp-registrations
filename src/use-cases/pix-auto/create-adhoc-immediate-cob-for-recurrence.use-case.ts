import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { buildTxid } from "@/infra/efi/txid";
import { AppError } from "@/lib/http-errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

function assertEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

type Input = {
  recurrenceId: string;
  competencia: string; // YYYY-MM
  amount?: string; // Opcional: sobrescreve o valor da recorrência
  infoAdicional?: string;
};

/**
 * Cria uma cobrança IMEDIATA (v2/cob) para suprir uma lacuna da recorrência (v2/cobr),
 * útil para o último dia do mês quando a recorrência falha devido às regras de D+2 da Efí.
 */
export async function createAdhocImmediateCobForRecurrenceUseCase(
  input: Input,
) {
  const pixKey = assertEnv("EFI_PIX_KEY");
  const { recurrenceId, competencia } = input;

  const rec = await prisma.pixAutoRecurrence.findUnique({
    where: { id: recurrenceId },
    include: {
      participant: true,
      event: true,
    },
  });

  if (!rec) {
    throw new AppError("Recurrence not found", 404, "RECURRENCE_NOT_FOUND");
  }

  const amount = input.amount || rec.valorRec;
  const infoAdicional =
    input.infoAdicional || `Cobrança Avulsa ${competencia} - ${rec.event.name}`;

  // TXID determinístico para evitar duplicidade acidental
  const txid = buildTxid({
    eventId: rec.eventId,
    kind: "COB_IMMEDIATE",
    participantId: rec.participantId,
    dueDate: competencia, // Usamos a competencia como "data" para o hash
    installmentIndex: 99, // Index alto para diferenciar de cobranças iniciais
  });

  const idempotencyKey = `adhoc-cob-${txid}`;

  // 1. Verifica se já existe no banco
  const existing = await prisma.pixCobImmediate.findUnique({
    where: { idempotencyKey },
  });

  if (existing && ["CONCLUIDA", "ATIVA", "PAGO"].includes(existing.status)) {
    return existing;
  }

  // 2. Tenta criar na Efí
  let cobResp;
  try {
    cobResp = await pixAutoClient.cob.put(txid, {
      calendario: { expiracao: 3600 * 24 * 7 }, // 7 dias
      devedor: {
        cpf: rec.participant.cpf,
        nome: rec.participant.fullName,
      },
      valor: { original: amount },
      chave: pixKey,
      solicitacaoPagador: infoAdicional,
    });
  } catch (err) {
    if (pixAutoClient.errors.isTxidInUse(err)) {
      logger.info(`[ADHOC-COB] txid=${txid} em uso. Sincronizando...`);
      cobResp = await pixAutoClient.cob.get(txid);
    } else {
      throw err;
    }
  }

  // 3. Upsert no banco
  const data = {
    eventId: rec.eventId,
    participantId: rec.participantId,
    txid,
    status: cobResp.status || "ATIVA",
    valorOriginal: amount,
    idempotencyKey,
    payload: asInputJson(cobResp),
  };

  return prisma.pixCobImmediate.upsert({
    where: { idempotencyKey },
    update: data,
    create: data,
  });
}
