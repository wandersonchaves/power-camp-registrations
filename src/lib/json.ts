import { Prisma } from "@prisma/client";

export type PrismaJsonNullableInput =
  | Prisma.InputJsonValue
  | Prisma.NullableJsonNullValueInput;

export function toPrismaJsonNullableInput(
  value: unknown,
): PrismaJsonNullableInput {
  if (value === null || value === undefined) {
    return Prisma.DbNull; // ✅ agora o tipo permite DbNull
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
