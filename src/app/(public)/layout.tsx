import React from "react";

import Navbar from "@/components/navbar/navbar";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function PublicLayout({ children }: React.PropsWithChildren) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <ThemeSwitcher className="absolute bottom-5 right-5 z-10" />
    </>
  );
}
