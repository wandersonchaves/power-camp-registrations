import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const names = [
    "Maria Clara Vieira Machado",
    "Adrielly raylla",
    "Adrielly Raylla",
  ];

  const participants = await prisma.participant.findMany({
    where: {
      fullName: {
        contains: "", // I'll use a better search
      },
    },
  });

  const matches = participants.filter((p) =>
    names.some((n) => p.fullName.toLowerCase().includes(n.toLowerCase())),
  );

  console.log("--- Matches ---");
  console.log(JSON.stringify(matches, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
