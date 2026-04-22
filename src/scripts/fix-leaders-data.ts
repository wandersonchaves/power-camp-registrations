import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Dados fornecidos pelo usuário
const EVENT_ID = "cmlvo8pnk00003z62644olpv6"; // PowerCamp 2027
const CORRECT_COLLECTIVE_VALUE = "933.50";

async function main() {
  console.log("--- INICIANDO CORREÇÃO DE LÍDERES (PRODUÇÃO) ---");

  // 1. CANCELAR RECORRÊNCIAS INDEVIDAS (Gabriel e Lucas)
  const namesToRemove = ["Gabriel Henriles", "Lucas Castelo Branco de Sousa"];

  for (const name of namesToRemove) {
    const participant = await prisma.participant.findFirst({
      where: {
        fullName: { contains: name.split(" ")[0], mode: "insensitive" },
        eventId: EVENT_ID,
      },
      include: {
        recurrences: true,
        enrollments: { include: { initialPayment: true } },
      },
    });

    if (participant) {
      console.log(`\nParticipante Identificado: ${participant.fullName}`);

      // Cancelar Recorrências Coletivas
      for (const rec of participant.recurrences) {
        if (rec.objeto?.includes("Equipe") && rec.status !== "CANCELADA") {
          console.log(
            `  - Cancelando Recorrência Coletiva ${rec.idRec} (Valor anterior: ${rec.valorRec})`,
          );
          await prisma.pixAutoRecurrence.update({
            where: { id: rec.id },
            data: { status: "CANCELADA_INDUE_LEADER" },
          });
        }
      }

      // Corrigir valor do pagamento inicial (Mês 1) se necessário
      // Se eles deveriam ter pago o valor individual (ex: 18.30) e não 933.30
      for (const enrollment of participant.enrollments) {
        if (
          enrollment.initialPayment &&
          enrollment.initialPayment.amount.includes("933")
        ) {
          console.log(
            `  - Alerta: Pagamento Inicial de R$ ${enrollment.initialPayment.amount} detectado para ${name}.`,
          );
          console.log(
            `    (Nota: O status PAGO será mantido, mas o registro não aparecerá mais como Líder no dashboard).`,
          );
        }
      }
    } else {
      console.log(`\n[!] Participante ${name} não encontrado no evento.`);
    }
  }

  // 2. AJUSTAR VALOR DOS LÍDERES LEGÍTIMOS (Artur e Bruno)
  const leadersToKeep = [
    { name: "Artur Felipe", team: "AGUIA" },
    { name: "Bruno Lopes", team: "LEAO" },
  ];

  for (const leader of leadersToKeep) {
    const participant = await prisma.participant.findFirst({
      where: {
        fullName: { contains: leader.name, mode: "insensitive" },
        eventId: EVENT_ID,
      },
      include: { recurrences: true },
    });

    if (participant) {
      console.log(`\nLíder Legítimo: ${participant.fullName} (${leader.team})`);
      for (const rec of participant.recurrences) {
        if (rec.objeto?.includes("Equipe")) {
          console.log(
            `  - Ajustando valor da recorrência para R$ ${CORRECT_COLLECTIVE_VALUE}`,
          );
          await prisma.pixAutoRecurrence.update({
            where: { id: rec.id },
            data: { valorRec: CORRECT_COLLECTIVE_VALUE },
          });
        }
      }
    }
  }

  console.log("\n--- CORREÇÃO FINALIZADA ---");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
