"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Trophy,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Session } from "next-auth";

import { UserDropdown } from "@/components/navbar/user-dropdown";
import { cn } from "@/lib/utils";

const ADMIN_LINKS = [
  { label: "Placar Geral", href: "/admin/race", icon: Trophy },
  { label: "Participantes", href: "/admin/participants", icon: Users },
  { label: "Recorrência", href: "/admin/recurring", icon: Zap },
  { label: "Importação", href: "/import", icon: Upload },
];

const TEAM_LINKS = [
  {
    label: "Equipe Águia",
    href: "/admin/teams/AGUIA",
    icon: "🦅",
    color: "blue",
  },
  { label: "Equipe Leão", href: "/admin/teams/LEAO", icon: "🦁", color: "red" },
];

export function AdminSidebar({ session }: { session: Session | null }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "bg-card relative flex flex-col border-r shadow-sm transition-all duration-300 ease-in-out",
        collapsed ? "w-20" : "w-64",
      )}
    >
      {/* Header / Logo */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/admin/race" className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground shadow-primary/20 flex size-10 items-center justify-center rounded-2xl shadow-lg">
            <Zap className="size-6" />
          </div>
          {!collapsed && (
            <span className="text-xl font-black uppercase tracking-tighter">
              Power<span className="text-primary">Camp</span>
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className="mb-4">
          {!collapsed && (
            <p className="text-muted-foreground/60 mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em]">
              Principal
            </p>
          )}
          {ADMIN_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-primary/10 shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-5 shrink-0",
                    !isActive &&
                      "text-muted-foreground/60 group-hover:text-foreground",
                  )}
                />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </div>

        <div>
          {!collapsed && (
            <p className="text-muted-foreground/60 mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em]">
              Equipes Arena
            </p>
          )}
          {TEAM_LINKS.map((link) => {
            const isActive = pathname.includes(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                  isActive
                    ? link.color === "blue"
                      ? "bg-blue-600 text-white shadow-blue-100"
                      : "bg-red-600 text-white shadow-red-100"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="shrink-0 text-xl">{link.icon}</span>
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer Area */}
      <div className="space-y-2 border-t p-3">
        {session && (
          <div className="mb-2">
            <UserDropdown session={session} showDetails={!collapsed} />
          </div>
        )}

        <Link
          href="/enroll"
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium"
        >
          <Home className="size-5" />
          {!collapsed && <span>Ver Site Público</span>}
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium"
        >
          {collapsed ? (
            <ChevronRight className="size-5" />
          ) : (
            <ChevronLeft className="size-5" />
          )}
          {!collapsed && <span>Recolher Menu</span>}
        </button>
      </div>
    </aside>
  );
}
