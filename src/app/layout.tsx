import "@/styles/globals.css";

import type { ReactNode } from "react";

import { AppChrome } from "@/components/layouts/AppChrome";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { getAuthSession } from "@/lib/auth/server";
import { AuthSessionProvider } from "@/lib/auth/session-provider";
import { fonts } from "@/lib/fonts";
import { cn } from "@/lib/utils";

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAuthSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen font-sans", fonts.join(" "))}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthSessionProvider session={session}>
            <AppChrome>{children}</AppChrome>
          </AuthSessionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
