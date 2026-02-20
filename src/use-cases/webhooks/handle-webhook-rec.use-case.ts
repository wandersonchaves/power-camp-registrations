import { sha256 } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

export async function handleWebhookRecUseCase(payload: unknown) {
  const externalId = sha256(JSON.stringify(payload));

  const saved = await prisma.efiWebhookEvent.upsert({
    where: { kind_externalId: { kind: "rec", externalId } },
    update: {},
    create: { kind: "rec", externalId, payload: asInputJson(payload) },
  });

  await prisma.efiWebhookEvent.update({
    where: { id: saved.id },
    data: { processedAt: new Date() },
  });

  return { ok: true };
}
