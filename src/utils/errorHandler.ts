import {Prisma} from '@prisma/client'
import {AxiosError} from 'axios'
import {NextResponse} from 'next/server'

export interface ErrorHandlerOptions {
  context?: string
  silent?: boolean
  defaultErrorMessage?: string
  returnHttpResponse?: boolean
}

export class ErrorHandler {
  static async handle<T>(
    asyncFn: () => Promise<T>,
    options: ErrorHandlerOptions = {},
  ): Promise<T | NextResponse | null> {
    const {
      context = 'Desconhecido',
      silent = false,
      defaultErrorMessage = 'Ocorreu um erro inesperado.',
      returnHttpResponse = true,
    } = options

    try {
      return await asyncFn()
    } catch (error) {
      if (!silent) {
        console.error(
          `[ErrorHandler] Context: ${context} - Detalhes do Erro:`,
          error,
        )
      }

      const userFriendlyMessage = this.getFriendlyMessage(
        error,
        defaultErrorMessage,
      )

      this.logError(error, context)

      if (returnHttpResponse && typeof window === 'undefined') {
        return NextResponse.json({error: userFriendlyMessage}, {status: 500})
      }

      return null
    }
  }

  private static getFriendlyMessage(
    error: unknown,
    defaultMessage: string,
  ): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return this.getPrismaErrorMessage(error)
    }

    if (error instanceof AxiosError) {
      return (
        error.response?.data?.message || 'Erro na comunicação com o servidor.'
      )
    }

    if (error instanceof SyntaxError) {
      return 'Erro na formatação dos dados enviados.'
    }

    if (error instanceof Error) {
      return error.message
    }

    return defaultMessage
  }

  private static getPrismaErrorMessage(
    error: Prisma.PrismaClientKnownRequestError,
  ): string {
    const errorMessages: Record<string, string> = {
      P2002: 'Um registro com essas informações já existe.',
      P2025: 'Registro não encontrado.',
    }

    return (
      errorMessages[error.code] || 'Erro no banco de dados. Tente novamente.'
    )
  }

  private static logError(error: unknown, context?: string): void {
    const isProduction = process.env.EFI_SANDBOX === 'false'

    const logDetails = {
      timestamp: new Date().toISOString(),
      context,
      error: this.serializeError(error),
    }

    if (isProduction) {
      console.log('[Log - Production]', JSON.stringify(logDetails))
    } else {
      console.error('[Log - Development]', logDetails)
    }
  }

  private static serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    if (typeof error === 'object' && error !== null) {
      return {...error}
    }

    return {error: String(error)}
  }
}
