// src/lib/auth/server.ts
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";

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
    const session = await getServerSession(authOptions);
    return session;
  } catch {
    // Erros como "Invalid Compact JWE" acontecem se o NEXTAUTH_SECRET mudar
    // Retornamos null para tratar o usuário como deslogado sem quebrar o app
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[auth] Session invalid or secret mismatch. Redirecting to guest state.",
      );
    }
    return null;
  }
}
