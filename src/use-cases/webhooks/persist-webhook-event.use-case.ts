import type { Prisma } from "@prisma/client";

import { sha256 } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

export async function persistWebhookEvent(params: {
  kind: "webhookrec" | "webhookcobr";
  payload: Prisma.JsonValue;
}) {
  const externalId = sha256(JSON.stringify(params.payload));

  const saved = await prisma.efiWebhookEvent.upsert({
    where: { kind_externalId: { kind: params.kind, externalId } },
    update: {},
    create: {
      kind: params.kind,
      externalId,
      payload: asInputJson(params.payload),
    },
  });

  return saved;
}
