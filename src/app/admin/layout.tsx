import type { ReactNode } from "react";

import { AdminShell } from "./_components/AdminShell";

export default function AdminLayout(props: { children: ReactNode }) {
  return <AdminShell>{props.children}</AdminShell>;
}
