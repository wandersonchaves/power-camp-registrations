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
        isActive: true, // se existir no seu schema; se não existir, remova
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
