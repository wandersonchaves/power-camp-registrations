// src/app/api/auth/[...nextauth]/auth-options.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { env } from "@/env.mjs";
import { prisma } from "@/lib/prisma";

type AppRole = "ADMIN" | "USER";

type TokenWithAppFields = {
  sub?: string;
  role?: AppRole;
  isActive?: boolean;
};

/**
 * Lê role/isActive do banco com segurança.
 * - Evita depender apenas do "user" do callback (que só vem no 1º login).
 * - Garante que o middleware receba token.role/token.isActive.
 */
async function loadUserFlags(userId: string): Promise<{
  role: AppRole;
  isActive: boolean;
} | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  if (!u) return null;

  return {
    role: (u.role ?? "USER") as AppRole,
    isActive: Boolean(u.isActive),
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // ✅ middleware usa getToken(); com callbacks jwt isso precisa ser JWT
  session: { strategy: "jwt" },

  secret: env.NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      const t = token as TokenWithAppFields;

      // 1) No 1º login, user existe e já tem id (e pode ter role/isActive)
      if (user) {
        const u = user as unknown as {
          id?: string;
          role?: AppRole;
          isActive?: boolean;
        };

        // Garante sub (algumas configs podem não preencher imediatamente)
        if (u.id) t.sub = u.id;

        // Se o user do adapter já vier com role/isActive, usa
        if (u.role) t.role = u.role;
        if (typeof u.isActive === "boolean") t.isActive = u.isActive;

        // Se não vier, busca no banco (fonte de verdade)
        if (t.sub && (t.role == null || t.isActive == null)) {
          const flags = await loadUserFlags(t.sub);
          if (flags) {
            t.role = flags.role;
            t.isActive = flags.isActive;
          } else {
            // fallback seguro
            t.role = t.role ?? "USER";
            t.isActive = Boolean(t.isActive);
          }
        }

        return t;
      }

      // 2) Nas requisições seguintes, user não existe.
      //    Se role/isActive estiverem ausentes (ou token antigo), carrega do banco.
      if (t.sub && (t.role == null || t.isActive == null)) {
        const flags = await loadUserFlags(t.sub);
        if (flags) {
          t.role = flags.role;
          t.isActive = flags.isActive;
        } else {
          t.role = t.role ?? "USER";
          t.isActive = Boolean(t.isActive);
        }
      }

      return t;
    },

    async session({ session, token }) {
      const t = token as TokenWithAppFields;

      if (!session.user) return session;

      // ✅ garante compat com seu middleware + UI
      // (se você tem module augmentation, isso tipa; se não, isso continua funcionando em runtime)
      session.user.id = t.sub ?? session.user.id;
      session.user.role = t.role ?? "USER";
      session.user.isActive = Boolean(t.isActive);

      return session;
    },
  },
};
