"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import Navbar from "@/components/navbar/navbar";
import { ThemeSwitcher } from "@/components/theme-switcher";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div className="bg-background text-foreground min-h-screen">
      {!isAdmin ? <Navbar /> : null}
      <main>{children}</main>
      {!isAdmin ? (
        <ThemeSwitcher className="fixed bottom-5 right-5 z-50" />
      ) : null}
    </div>
  );
}
