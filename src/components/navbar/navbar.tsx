"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { SignInButton } from "@/components/navbar/sign-in-button";
import { UserDropdown } from "@/components/navbar/user-dropdown";

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="bg-background w-full border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/enroll" className="font-mono text-lg font-bold">
          NEXT-POWER
        </Link>

        <div className="flex items-center gap-2">
          {status === "loading" ? null : session ? (
            <UserDropdown session={session} />
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  );
}
