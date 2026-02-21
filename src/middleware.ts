import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_FILE = /\.(.*)$/;

function isPublicPath(pathname: string) {
  // Next internals / assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  )
    return true;

  // APIs (inclui nextauth + webhooks)
  if (pathname.startsWith("/api")) return true;

  // arquivos públicos
  return PUBLIC_FILE.test(pathname);
}

function redirect(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // assets/apis não entram
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = await getToken({ req });
  const role = (token as { role?: "ADMIN" | "USER" } | null)?.role;
  const isActive = (token as { isActive?: boolean } | null)?.isActive;

  // ✅ ROOT: SEMPRE manda para /enroll (nunca mostrar a Home antiga)
  if (pathname === "/") {
    if (token && role === "ADMIN" && isActive)
      return redirect(req, "/admin/race");
    return redirect(req, "/enroll");
  }

  // ✅ Admin: precisa ser ADMIN + ativo
  if (pathname.startsWith("/admin")) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/api/auth/signin";
      url.searchParams.set("callbackUrl", "/admin/race");
      return NextResponse.redirect(url);
    }

    if (!isActive || role !== "ADMIN") {
      return redirect(req, "/enroll");
    }

    return NextResponse.next();
  }

  // ✅ USER (ou visitante) só pode ficar no fluxo de inscrição/pagamento
  // Ajuste a lista se você tiver outras telas públicas reais.
  const allowedForNonAdmin =
    pathname === "/enroll" || pathname.startsWith("/enroll/");

  if (!allowedForNonAdmin) {
    // ADMIN ativo pode navegar fora
    if (token && role === "ADMIN" && isActive) return NextResponse.next();
    return redirect(req, "/enroll");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
