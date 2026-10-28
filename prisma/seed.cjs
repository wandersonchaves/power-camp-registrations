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
        isActive: true,
      },
    }));

  const aguia = await prisma.team.upsert({
    where: { code: "AGUIA" },
    update: { name: "Equipe Águia" },
    create: { code: "AGUIA", name: "Equipe Águia" },
  });

  const leao = await prisma.team.upsert({
    where: { code: "LEAO" },
    update: { name: "Equipe Leão" },
    create: { code: "LEAO", name: "Equipe Leão" },
  });

  // ✅ Parcelas das equipes: 9 mensais (abr–dez/2026), vencimento dia 10.
  // Idempotente (unique teamId+dueMonth) e sem sobrescrever valores existentes.
  const amountCents = Number(
    process.env.TEAM_INSTALLMENT_AMOUNT_CENTS ?? 93330,
  );
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("TEAM_INSTALLMENT_AMOUNT_CENTS inválido");
  }
  const dueMonths = Array.from(
    { length: 9 },
    (_, i) => new Date(Date.UTC(2026, 3 + i, 10)),
  );
  for (const team of [aguia, leao]) {
    await prisma.teamInstallment.createMany({
      data: dueMonths.map((dueMonth) => ({
        teamId: team.id,
        dueMonth,
        amountCents,
      })),
      skipDuplicates: true,
    });
  }

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
