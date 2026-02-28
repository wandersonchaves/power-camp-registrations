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

function requireString(value: unknown, name: string): string {
  const v = String(value ?? "").trim();
  if (!v) throw new Error(`[auth] Missing env: ${name}`);
  return v;
}

/**
 * Lê role/isActive do banco com segurança.
 * - Evita depender apenas do "user" do callback (que só vem no 1º login).
 * - Garante que o middleware receba token.role/token.isActive.
 */
async function loadUserFlags(
  userId: string,
): Promise<{ role: AppRole; isActive: boolean } | null> {
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

  /**
   * ✅ Middleware usa getToken(); com callbacks jwt isso precisa ser JWT.
   * (Se for "database", role/isActive não chegam no token.)
   */
  session: { strategy: "jwt" },

  /**
   * ✅ Garante string no build/runtime.
   * Ideal: env.mjs tipado corretamente, mas isso evita "unknown" e falha cedo se ausente.
   */
  secret: requireString(env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET"),

  providers: [
    GoogleProvider({
      clientId: requireString(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID"),
      clientSecret: requireString(
        env.GOOGLE_CLIENT_SECRET,
        "GOOGLE_CLIENT_SECRET",
      ),
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

        if (u.id) t.sub = u.id;

        // Se o adapter já trouxer role/isActive, usa direto
        if (u.role) t.role = u.role;
        if (typeof u.isActive === "boolean") t.isActive = u.isActive;

        // Se não veio, busca no banco (fonte de verdade)
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
      }

      // 2) Nas requisições seguintes, user não existe.
      //    Só busca no banco se faltarem campos (evita query em todo request).
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

      /**
       * ✅ Mantém compat com UI e middleware.
       * Obs: Para tipagem perfeita, garanta module augmentation em next-auth.d.ts.
       */
      session.user.id = t.sub ?? session.user.id;
      session.user.role = t.role ?? "USER";
      session.user.isActive = Boolean(t.isActive);

      return session;
    },
  },
};
