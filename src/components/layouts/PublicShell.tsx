import type { ReactNode } from "react";

import Navbar from "@/components/navbar/navbar";
import { ThemeSwitcher } from "@/components/theme-switcher";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <Navbar />
      <main>{children}</main>
      <ThemeSwitcher className="fixed bottom-5 right-5 z-50" />
    </div>
  );
}
