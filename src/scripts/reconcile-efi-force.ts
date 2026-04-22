import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_DATA = [
  {
    txid: "6690790def96e7587f59f74d730c252f",
    status: "CONCLUIDA",
    nome: "Maria Clara Vieira Machado",
    cpf: "08000655306",
    valor: "18.30",
    paidAt: "2026-04-03T14:45:04.000Z",
    criacao: "2026-04-03T14:37:25.000Z",
  },
  {
    txid: "2cfaf060d33a466bfde031ff24e5de66",
    status: "CONCLUIDA",
    nome: "Adrielly raylla",
    cpf: "09971402327",
    valor: "18.30",
    paidAt: "2026-04-03T14:59:43.000Z",
    criacao: "2026-04-03T14:36:52.000Z",
  },
  {
    txid: "a06f194477fecbbc63b1b933998bd0e0",
    status: "ATIVA",
    nome: "Maria Clara Vieira Machado",
    cpf: "08000655306",
    valor: "18.30",
    criacao: "2026-03-27T00:11:19.000Z",
  },
  {
    txid: "aa668d0e2bf15d48259a361c8c31b7de",
    status: "ATIVA",
    nome: "Adrielly raylla",
    cpf: "09971402327",
    valor: "18.30",
    criacao: "2026-03-27T00:10:42.000Z",
  },
  {
    txid: "894102de90141f6e19caafcfd9174a61",
    status: "ATIVA",
    nome: "Maria Clara Vieira Machado",
    cpf: "08000655306",
    valor: "18.30",
    criacao: "2026-03-25T21:57:28.000Z",
  },
  {
    txid: "9f9243c6e2c9c9a68edccac9844f6d55",
    status: "ATIVA",
    nome: "Adrielly raylla",
    cpf: "09971402327",
    valor: "18.30",
    criacao: "2026-03-25T21:56:39.000Z",
  },
  {
    txid: "47c40a6eba98fa19899eb8952e366ad9",
    status: "ATIVA",
    nome: "Maria Clara Vieira Machado",
    cpf: "08000655306",
    valor: "18.30",
    criacao: "2026-03-25T00:23:39.000Z",
  },
  {
    txid: "03533831458febfaaeb33750de238053",
    status: "ATIVA",
    nome: "Maria Clara Vieira Machado",
    cpf: "08000655306",
    valor: "18.30",
    criacao: "2026-03-25T00:22:28.000Z",
  },
  {
    txid: "2704f9d9cab8d3aa892ce1d7133217d2",
    status: "ATIVA",
    nome: "Adrielly Raylla",
    cpf: "09971402327",
    valor: "18.30",
    criacao: "2026-03-25T00:21:53.000Z",
  },
];

async function main() {
  console.log("--- PROD Force Reconcile ---");

  // 1. Buscar o Evento dinamicamente pelo nome
  const event = await prisma.event.findFirst({
    where: { name: { contains: "PowerCamp 2027", mode: "insensitive" } },
  });

  if (!event) {
    throw new Error(
      "Evento 'PowerCamp 2027' não encontrado no banco de dados!",
    );
  }
  console.log(`Evento encontrado: ${event.name} (ID: ${event.id})`);

  // 2. Buscar um usuário administrador para vincular participantes novos
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (!adminUser) {
    throw new Error(
      "Nenhum usuário ADMIN encontrado para vincular novos registros!",
    );
  }
  console.log(
    `Usuário Admin para vínculo: ${adminUser.email} (ID: ${adminUser.id})`,
  );

  for (const data of TARGET_DATA) {
    const { txid, status, nome, cpf, valor, paidAt, criacao } = data;
    console.log(`\nProcessando TXID: ${txid} (${nome})`);

    try {
      let attempt = await prisma.initialPaymentAttempt.findFirst({
        where: { txid },
      });

      if (!attempt) {
        console.log(`  - Criando registros faltantes...`);

        // Participante
        let participant = await prisma.participant.findUnique({
          where: { eventId_cpf: { eventId: event.id, cpf } },
        });

        if (!participant) {
          participant = await prisma.participant.create({
            data: {
              fullName: nome,
              cpf,
              eventId: event.id,
              userId: adminUser.id,
              phone: "00000000000",
            },
          });
          console.log(`  - Participante criado: ${participant.id}`);
        }

        // Inscrição
        let enrollment = await prisma.enrollment.findUnique({
          where: {
            eventId_participantId: {
              eventId: event.id,
              participantId: participant.id,
            },
          },
        });

        if (!enrollment) {
          enrollment = await prisma.enrollment.create({
            data: {
              eventId: event.id,
              participantId: participant.id,
              status: "PENDING",
            },
          });
          console.log(`  - Inscrição criada: ${enrollment.id}`);
        }

        // Tentativa de Pagamento
        attempt = await prisma.initialPaymentAttempt.create({
          data: {
            enrollmentId: enrollment.id,
            txid,
            status: status === "CONCLUIDA" ? "PAID" : "ACTIVE",
            amount: valor,
            idempotencyKey: `manual-${txid}`,
            createdAtEfi: new Date(criacao),
            paidAt: paidAt ? new Date(paidAt) : null,
            payload: { source: "Force Reconcile Script", efiData: data },
          },
        });
      }

      // Se o status for CONCLUIDA, garantir que está pago no banco
      if (status === "CONCLUIDA") {
        await prisma.$transaction([
          prisma.initialPaymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "PAID",
              paidAt: paidAt ? new Date(paidAt) : attempt.paidAt || new Date(),
              createdAtEfi: new Date(criacao),
            },
          }),
          prisma.enrollment.update({
            where: { id: attempt.enrollmentId },
            data: {
              status: "CONFIRMED",
              confirmedAt: paidAt
                ? new Date(paidAt)
                : attempt.paidAt || new Date(),
            },
          }),
        ]);
        console.log(`  - STATUS: Pago e Inscrição Confirmada.`);
      } else {
        console.log(`  - STATUS: Ativo (Aguardando).`);
      }
    } catch (error) {
      console.error(`  - ERRO no TXID ${txid}:`, error);
    }
  }

  console.log("\nReconciliação Finalizada.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
