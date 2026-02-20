export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error)
    return new AppError(err.message, 500, "INTERNAL_ERROR");
  return new AppError("Unknown error", 500, "INTERNAL_ERROR", err);
}
