import { ReactNode } from "react";

import { AdminSidebar } from "./AdminSidebar";
import { UserNavbar } from "./UserNavbar";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { getAuthSession } from "@/lib/auth/server";

interface SiteShellProps {
  children: ReactNode;
  isDashboardRoute?: boolean;
}

export async function SiteShell({
  children,
  isDashboardRoute = false,
}: SiteShellProps) {
  const session = await getAuthSession();
  const isAdmin = session?.user.role === "ADMIN" && isDashboardRoute;

  if (isAdmin) {
    return (
      <div className="bg-background text-foreground flex min-h-screen overflow-hidden">
        {/* Sidebar fixa no desktop, gaveta no mobile futuramente */}
        <AdminSidebar session={session} />

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Navbar para Admin (Breadcrumbs + User Profile) */}
          <header className="bg-card flex h-16 items-center justify-between border-b px-8">
            <div className="text-muted-foreground text-sm font-medium italic">
              Dashboard Administrativo
            </div>
            <div className="flex items-center gap-4">
              {/* Aqui poderíamos ter notificações, search, etc */}
              <ThemeSwitcher />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    );
  }

  // Layout Público / Usuário Comum
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <UserNavbar />
      <main className="flex-1">{children}</main>
      <ThemeSwitcher className="fixed bottom-6 right-6 z-50 shadow-xl" />
    </div>
  );
}
