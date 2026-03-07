import { Zap } from "lucide-react";
import Link from "next/link";

import { SignInButton } from "@/components/navbar/sign-in-button";
import { UserDropdown } from "@/components/navbar/user-dropdown";
import { getAuthSession } from "@/lib/auth/server";

export async function UserNavbar() {
  const session = await getAuthSession();

  return (
    <header className="bg-background/80 sticky top-0 z-40 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/enroll"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="bg-primary text-primary-foreground shadow-primary/20 flex size-9 items-center justify-center rounded-xl shadow-lg">
            <Zap className="size-5" />
          </div>
          <span className="hidden text-lg font-black uppercase tracking-tighter sm:inline-block">
            Power<span className="text-primary">Camp</span>
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <div className="text-muted-foreground hidden items-center gap-6 text-sm font-medium md:flex">
            <Link
              href="/enroll"
              className="hover:text-foreground transition-colors"
            >
              Inscrição
            </Link>
            {session?.user.role === "ADMIN" && (
              <Link
                href="/admin/race"
                className="hover:text-foreground text-primary font-bold transition-colors"
              >
                Painel Admin
              </Link>
            )}
          </div>

          <div className="bg-border hidden h-6 w-px md:block" />

          <div className="flex items-center gap-4">
            {session ? <UserDropdown session={session} /> : <SignInButton />}
          </div>
        </nav>
      </div>
    </header>
  );
}
