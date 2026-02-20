export function toCamelCase<T>(data: unknown): T {
  if (Array.isArray(data)) {
    return data.map((item) => toCamelCase(item)) as unknown as T;
  }
  if (typeof data === "object" && data !== null) {
    return Object.entries(data).reduce(
      (acc, [key, value]) => {
        const newKey = key.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase(),
        );
        (acc as Record<string, unknown>)[newKey] = toCamelCase(value);
        return acc;
      },
      {} as Record<string, unknown>,
    ) as T;
  }
  return data as T;
}

export function toSnakeCase<T>(data: unknown): T {
  if (Array.isArray(data)) {
    return data.map((item) => toSnakeCase(item)) as unknown as T;
  }
  if (typeof data === "object" && data !== null) {
    return Object.entries(data).reduce(
      (acc, [key, value]) => {
        const newKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        (acc as Record<string, unknown>)[newKey] = toSnakeCase(value);
        return acc;
      },
      {} as Record<string, unknown>,
    ) as T;
  }
  return data as T;
}
