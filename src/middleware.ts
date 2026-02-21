import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

type AppRole = "ADMIN" | "USER";
type AuthToken = { role?: AppRole; isActive?: boolean } | null;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Rotas públicas sempre liberadas
  if (
    pathname.startsWith("/enroll") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/" // se você quiser manter landing pública
  ) {
    return NextResponse.next();
  }

  // ✅ Admin precisa de sessão e role
  if (pathname.startsWith("/admin")) {
    const token = (await getToken({ req })) as AuthToken;
    const role = token?.role;
    const isActive = token?.isActive;

    if (!token)
      return NextResponse.redirect(new URL("/api/auth/signin", req.url));
    if (!isActive || role !== "ADMIN")
      return NextResponse.redirect(new URL("/enroll", req.url));

    return NextResponse.next();
  }

  // ✅ Qualquer outra rota protegida (se existir)
  const token = await getToken({ req });
  if (!token) return NextResponse.redirect(new URL("/enroll", req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
