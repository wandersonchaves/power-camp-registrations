import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { env } from "@/env.mjs";
import { prisma } from "@/lib/prisma";

type AppRole = "ADMIN" | "USER";

type UserWithRole = {
  id: string;
  role: AppRole;
  isActive: boolean;
};

function isUserWithRole(u: unknown): u is UserWithRole {
  return (
    !!u &&
    typeof u === "object" &&
    "role" in u &&
    "isActive" in u &&
    typeof (u as { role?: unknown }).role === "string" &&
    typeof (u as { isActive?: unknown }).isActive === "boolean"
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "database" }, // ok com adapter
  callbacks: {
    async jwt({ token, user }) {
      if (isUserWithRole(user)) {
        token.role = user.role;
        token.isActive = user.isActive;
      }
      return token;
    },

    async session({ session, user }) {
      if (!session.user) return session;

      session.user.id = user.id;
      session.user.isActive = user.isActive;
      session.user.role = user.role;

      return session;
    },
  },
  events: {
    createUser: async ({ user }) => {
      if (!user.email || !user.name) return;
    },
  },
};
