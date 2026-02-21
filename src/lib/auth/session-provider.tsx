"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider(props: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={props.session} refetchOnWindowFocus={false}>
      {props.children}
    </SessionProvider>
  );
}
