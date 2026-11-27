/**
 * Política de acesso das rotas /api (default-deny).
 *
 * Toda rota de /api exige um ADMIN ativo, exceto as listadas aqui. Rota nova
 * nasce fechada: para abrir, ela precisa entrar neste arquivo e no teste.
 */

export type ApiAccess = "public" | "admin";

/**
 * Públicas porque têm a própria autenticação ou são parte do fluxo público:
 * - /api/auth/*: NextAuth.
 * - /api/webhooks/efi/*: cada handler confere HMAC/IP (efi-webhook.guard).
 * - /api/cron/*: cada handler confere `Authorization: Bearer $CRON_SECRET`.
 * - /api/enrollments/:id/status: a página de sucesso da inscrição consulta o
 *   andamento do próprio pagamento (só status e datas, sem dados pessoais).
 */
const PUBLIC_API: RegExp[] = [
  /^\/api\/auth(\/|$)/,
  /^\/api\/webhooks\/efi(\/|$)/,
  /^\/api\/cron(\/|$)/,
  /^\/api\/enrollments\/[^/]+\/status\/?$/,
];

export function apiAccessFor(pathname: string): ApiAccess {
  return PUBLIC_API.some((re) => re.test(pathname)) ? "public" : "admin";
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
