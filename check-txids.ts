import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const txids = [
    "6690790def96e7587f59f74d730c252f",
    "2cfaf060d33a466bfde031ff24e5de66",
    "a06f194477fecbbc63b1b933998bd0e0",
    "aa668d0e2bf15d48259a361c8c31b7de",
    "894102de90141f6e19caafcfd9174a61",
    "9f9243c6e2c9c9a68edccac9844f6d55",
    "47c40a6eba98fa19899eb8952e366ad9",
    "03533831458febfaaeb33750de238053",
    "2704f9d9cab8d3aa892ce1d7133217d2",
  ];

  console.log("--- InitialPaymentAttempt ---");
  const attempts = await prisma.initialPaymentAttempt.findMany({
    where: { txid: { in: txids } },
  });
  console.log(JSON.stringify(attempts, null, 2));

  console.log("\n--- PixCobImmediate ---");
  const immediates = await prisma.pixCobImmediate.findMany({
    where: { txid: { in: txids } },
  });
  console.log(JSON.stringify(immediates, null, 2));

  console.log("\n--- PixAutoCobr ---");
  const cobrs = await prisma.pixAutoCobr.findMany({
    where: { txid: { in: txids } },
  });
  console.log(JSON.stringify(cobrs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
