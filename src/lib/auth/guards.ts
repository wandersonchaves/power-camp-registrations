import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/api/auth/signin");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();

  if (!session.user?.isActive) redirect("/enroll"); // ou /unauthorized
  if (session.user.role !== "ADMIN") redirect("/enroll"); // bloqueia total

  return session;
}
