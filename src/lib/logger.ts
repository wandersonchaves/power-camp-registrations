// src/lib/logger.ts
export type LogLevel = "debug" | "info" | "warn" | "error";

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: "non-serializable meta" });
  }
}

export function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) {
  const payload = {
    level,
    message,
    ...(meta ?? {}),
    ts: new Date().toISOString(),
  };

  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](safeJson(payload));
}
