import { sha256 } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

export async function handleWebhookCobrUseCase(payload: unknown) {
  const externalId = sha256(JSON.stringify(payload));

  const saved = await prisma.efiWebhookEvent.upsert({
    where: { kind_externalId: { kind: "cobr", externalId } },
    update: {},
    create: { kind: "cobr", externalId, payload: asInputJson(payload) },
  });

  await prisma.efiWebhookEvent.update({
    where: { id: saved.id },
    data: { processedAt: new Date() },
  });

  return { ok: true };
}
