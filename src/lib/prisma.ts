import { PrismaClient } from "@prisma/client";
// import {env} from 'node:process'

// declare global {
//   // eslint-disable-next-line no-var
//   var prisma: PrismaClient | undefined
// }

// export const prisma =
//   global.prisma || new PrismaClient({log: ['query', 'info', 'warn', 'error']})

export const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

// if (env.NODE_ENV === 'development') global.prisma = prisma
