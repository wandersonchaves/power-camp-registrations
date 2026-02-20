"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";

export const SignInButton = () => {
  const [isPending, startTransition] = useTransition();

  const handleSignIn = () => {
    startTransition(() => {
      signIn("google").catch((error) => {
        console.error("Erro ao realizar login:", error);
      });
    });
  };

  return (
    <Button onClick={handleSignIn} disabled={isPending}>
      {isPending && <Icons.Loader className="mr-2 size-4 animate-spin" />}
      Entrar
    </Button>
  );
};
