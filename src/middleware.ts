import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_FILE = /\.(.*)$/;

type TokenShape = {
  role?: "ADMIN" | "USER";
  isActive?: boolean;
};

function isPublicPath(pathname: string) {
  // Next internals / assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return true;
  }

  // APIs (inclui nextauth + webhooks)
  if (pathname.startsWith("/api")) return true;

  // arquivos públicos
  return PUBLIC_FILE.test(pathname);
}

function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

function redirectToSignIn(req: NextRequest) {
  const callbackUrl = req.nextUrl.clone();
  const url = req.nextUrl.clone();
  url.pathname = "/api/auth/signin";
  url.search = "";
  url.searchParams.set("callbackUrl", callbackUrl.toString());
  return NextResponse.redirect(url);
}

function isEnrollPath(pathname: string) {
  return pathname === "/enroll" || pathname.startsWith("/enroll/");
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) assets/apis não entram
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = (await getToken({ req })) as TokenShape | null;
  const role = token?.role;
  const isActive = Boolean(token?.isActive);

  const isAdmin = Boolean(token && isActive && role === "ADMIN");

  // 2) ROOT: Deixa passar para mostrar a Landing Page
  if (pathname === "/") {
    return NextResponse.next();
  }

  // 3) Rotas /admin: apenas ADMIN ativo
  if (isAdminPath(pathname)) {
    if (!token) return redirectToSignIn(req);
    if (!isAdmin) return redirectTo(req, "/enroll");
    return NextResponse.next();
  }

  // 4) Rotas permitidas para todos os logados ou visitantes (conforme lógica de cada página)
  if (isEnrollPath(pathname) || pathname === "/import") {
    return NextResponse.next();
  }

  // 5) Outras rotas (fallback):
  //    - ADMIN ativo: pode navegar
  //    - USER/visitante: joga para /enroll se não for admin
  if (isAdmin) return NextResponse.next();

  // Se estiver tentando acessar algo que não é / ou /enroll ou /import ou /admin e não for admin
  return redirectTo(req, "/enroll");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
