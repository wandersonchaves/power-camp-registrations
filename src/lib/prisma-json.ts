import { Prisma } from "@prisma/client";

// Converte valores "desconhecidos" em JSON seguro (serializável).
export function asInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
