import type { ReactNode } from "react";

import { SiteShell } from "@/components/layouts/SiteShell";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminLayout(props: { children: ReactNode }) {
  await requireAdmin();

  return <SiteShell isDashboardRoute={true}>{props.children}</SiteShell>;
}
