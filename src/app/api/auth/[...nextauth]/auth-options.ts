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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // ✅ Você usa middleware com getToken() + callbacks jwt => precisa ser JWT
  session: { strategy: "jwt" },

  // ✅ Evita "sub undefined" por secret ausente/instável (local/railway)
  secret: env.NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // No primeiro login, user existe (adapter)
      if (user) {
        const u = user as unknown as { role?: AppRole; isActive?: boolean };
        (token as TokenWithAppFields).role = u.role ?? "USER";
        (token as TokenWithAppFields).isActive = Boolean(u.isActive);
      }
      return token;
    },

    async session({ session, token }) {
      // Em JWT strategy, token contém o "sub" (userId)
      const t = token as TokenWithAppFields;

      if (!session.user) return session;

      session.user.id = t.sub ?? session.user.id;
      session.user.role = t.role ?? "USER";
      session.user.isActive = Boolean(t.isActive);

      return session;
    },
  },
};
