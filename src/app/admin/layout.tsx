import type { ReactNode } from "react";

import { AdminShell } from "./_components/AdminShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function AdminLayout(props: { children: ReactNode }) {
  return <AdminShell>{props.children}</AdminShell>;
}
