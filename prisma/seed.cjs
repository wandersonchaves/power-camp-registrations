const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const event = await prisma.event.findFirst({
    where: { year: 2027 },
    orderBy: { createdAt: "desc" },
  });

  const ensuredEvent =
    event ??
    (await prisma.event.create({
      data: {
        name: "PowerCamp 2027",
        year: 2027,
        // se existir no seu schema; se não existir, remova
        isActive: true,
      },
    }));

  await prisma.team.upsert({
    where: { code: "AGUIA" },
    update: { name: "Equipe Águia" },
    create: { code: "AGUIA", name: "Equipe Águia" },
  });

  await prisma.team.upsert({
    where: { code: "LEAO" },
    update: { name: "Equipe Leão" },
    create: { code: "LEAO", name: "Equipe Leão" },
  });

  // ✅ Promote Admin by env (recomendado)
  const adminEmail = String(process.env.ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  if (adminEmail) {
    const user = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "ADMIN", isActive: true },
      });

      console.log("✅ Admin promovido:", adminEmail);
    } else {
      console.log(
        "ℹ️ ADMIN_EMAIL definido, mas usuário ainda não existe no banco:",
        adminEmail,
      );
      console.log(
        "   Faça login 1x com Google e rode o seed novamente para promover.",
      );
    }
  } else {
    console.log("ℹ️ ADMIN_EMAIL não definido. Nenhum admin foi promovido.");
  }

  console.log("✅ Seed OK");
  console.log("📌 POWERCAMP_EVENT_ID:", ensuredEvent.id);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
