"use client";

import { ComponentProps } from "react";
import { useTheme } from "next-themes";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";

type ThemeSwitcherProps = {
  className?: ComponentProps<"button">["className"];
};

export const ThemeSwitcher = ({ className }: ThemeSwitcherProps) => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      className={className}
      variant="secondary"
      size="icon"
      aria-label="Rótulo de alternância do tema"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Icons.Sun className="dark:hidden" />
      <Icons.Moon className="hidden dark:block" />
    </Button>
  );
};
