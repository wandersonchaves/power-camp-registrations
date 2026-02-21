// scripts/fix-staging-user.cjs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const dry = process.argv.includes("--dry");

  if (!email) {
    console.error(
      "Uso: node scripts/fix-staging-user.cjs email@dominio.com [--dry]",
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    console.log("✅ User não encontrado:", email);
    return;
  }

  // Descobrir “dependências” antes (pra você enxergar o impacto)
  const counts = await prisma.$transaction([
    prisma.session.count({ where: { userId: user.id } }),
    prisma.account.count({ where: { userId: user.id } }),
    prisma.participant.count({ where: { userId: user.id } }),
  ]);

  const [sessionsCount, accountsCount, participantsCount] = counts;

  console.log("👤 User:", user);
  console.log("📌 Dependências:");
  console.log("- sessions:", sessionsCount);
  console.log("- accounts:", accountsCount);
  console.log("- participants:", participantsCount);

  if (dry) {
    console.log("🧪 DRY RUN: nada foi apagado.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1) apaga o que referencia User (FK)
    await tx.participant.deleteMany({ where: { userId: user.id } });

    // 2) apaga NextAuth tables
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.account.deleteMany({ where: { userId: user.id } });

    // 3) apaga o user
    await tx.user.delete({ where: { id: user.id } });
  });

  console.log("✅ Limpeza concluída (User + dependências):", email);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
