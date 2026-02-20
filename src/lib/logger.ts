export type LogLevel = "debug" | "info" | "warn" | "error";

export function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) {
  const payload = {
    level,
    message,
    ...meta,
    ts: new Date().toISOString(),
  };

  // Console estruturado (ok pra Vercel/Docker/CloudWatch)
  // Nunca logue segredos.
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](JSON.stringify(payload));
}
