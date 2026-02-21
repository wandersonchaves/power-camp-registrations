import type { ReactNode } from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function EnrollLayout({ children }: { children: ReactNode }) {
  return children;
}
