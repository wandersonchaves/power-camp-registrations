// src/lib/auth/server.ts
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

async function hasNextAuthCookie() {
  const store = await cookies();
  return (
    store.has("next-auth.session-token") ||
    store.has("__Secure-next-auth.session-token")
  );
}

export async function getAuthSession() {
  // ✅ Sem cookie => não tenta ler sessão (mais rápido e evita spam)
  if (!(await hasNextAuthCookie())) return null;

  try {
    return await getServerSession(authOptions);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[auth] getServerSession failed:", err);
    }
    return null;
  }
}
