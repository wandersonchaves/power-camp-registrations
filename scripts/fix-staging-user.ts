import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email)
    throw new Error(
      "Passe o email: node scripts/fix-staging-user.ts user@email.com",
    );

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log("User não encontrado:", email);
    return;
  }

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });

  // Se quiser zerar tudo do usuário em staging:
  await prisma.user.delete({ where: { id: user.id } });

  console.log("✅ Limpeza concluída para:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
