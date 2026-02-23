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

  // 2) ROOT: manda admin ativo para admin, senão para enroll
  if (pathname === "/") {
    return isAdmin
      ? redirectTo(req, "/admin/race")
      : redirectTo(req, "/enroll");
  }

  // 3) Rotas /admin: apenas ADMIN ativo
  if (isAdminPath(pathname)) {
    if (!token) return redirectToSignIn(req);
    if (!isAdmin) return redirectTo(req, "/enroll");
    return NextResponse.next();
  }

  // 4) Rotas /enroll: todo mundo pode acessar (admin também)
  if (isEnrollPath(pathname)) {
    return NextResponse.next();
  }

  // 5) Outras rotas:
  //    - ADMIN ativo: pode navegar
  //    - USER/visitante: joga para /enroll
  if (isAdmin) return NextResponse.next();
  return redirectTo(req, "/enroll");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
