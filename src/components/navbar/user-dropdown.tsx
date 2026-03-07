"use client";

import { LogOut, Settings, ShieldCheck, User as UserIcon } from "lucide-react";
import Image from "next/image";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface UserDropdownProps {
  session: Session;
  showDetails?: boolean;
}

export const UserDropdown = ({
  session: { user },
  showDetails = false,
}: UserDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-3 text-left outline-none transition-opacity hover:opacity-80",
            showDetails ? "hover:bg-accent w-full rounded-xl p-2" : "",
          )}
        >
          <div className="border-muted bg-muted relative size-9 overflow-hidden rounded-xl border-2 shadow-sm">
            {user?.image ? (
              <Image
                src={user.image}
                alt={user.name || "User"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="bg-primary/10 text-primary flex size-full items-center justify-center">
                <UserIcon className="size-5" />
              </div>
            )}
          </div>

          {showDetails && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-bold leading-none">
                {user?.name}
              </span>
              <span className="text-muted-foreground mt-1 truncate text-[10px]">
                {user?.email}
              </span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={showDetails ? "start" : "end"}
        className="mt-2 w-56 p-2"
      >
        <DropdownMenuLabel className="flex flex-col px-2 py-1.5">
          <span className="text-muted-foreground/60 mb-1 text-xs font-bold uppercase tracking-widest">
            Conta Ativa
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold">{user?.name}</span>
            {user?.role === "ADMIN" && (
              <ShieldCheck className="text-primary size-3" />
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-2" />

        <DropdownMenuItem className="focus:bg-accent cursor-pointer rounded-lg py-2">
          <Settings className="text-muted-foreground mr-2 size-4" />
          <span>Configurações</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-2" />

        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/enroll" })}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-lg py-2"
        >
          <LogOut className="mr-2 size-4" />
          <span className="font-bold">Encerrar Sessão</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
