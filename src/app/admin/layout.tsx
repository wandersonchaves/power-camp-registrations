import type { ReactNode } from "react";

import { AdminShell } from "./_components/AdminShell";

import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminLayout(props: { children: ReactNode }) {
  await requireAdmin(); // ✅ garante que ninguém entra sem ADMIN

  return <AdminShell>{props.children}</AdminShell>;
}
