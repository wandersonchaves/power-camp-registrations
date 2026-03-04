import type { ReactNode } from "react";

import { SiteShell } from "@/components/layouts/SiteShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function EnrollLayout({ children }: { children: ReactNode }) {
  return <SiteShell isDashboardRoute={false}>{children}</SiteShell>;
}
