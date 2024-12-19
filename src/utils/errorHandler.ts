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
  /**
   * Trata erros de forma dinâmica e personalizada.
   * @param asyncFn Função assíncrona que será envolvida pelo ErrorHandler.
   * @param options Configurações de contexto e comportamento do erro.
   * @returns O resultado da função assíncrona ou null em caso de erro.
   */
  static async handle<T>(
    asyncFn: () => Promise<T>,
    options: ErrorHandlerOptions = {},
  ): Promise<T | NextResponse | null> {
    const {
      context,
      silent = false,
      defaultErrorMessage = 'Ocorreu um erro inesperado.',
      returnHttpResponse = true,
    } = options

    try {
      return await asyncFn()
    } catch (error) {
      if (!silent) {
        console.error(
          `[ErrorHandler] Context: ${context || 'Desconhecido'} - Detalhes do Erro:`,
          error,
        )
      }

      const userFriendlyMessage = ErrorHandler.getFriendlyMessage(
        error,
        defaultErrorMessage,
      )

      ErrorHandler.sendToMonitoring(error, context)

      if (returnHttpResponse && typeof window === 'undefined') {
        return NextResponse.json({error: userFriendlyMessage}, {status: 500})
      }

      return null
    }
  }

  /**
   * Gera uma mensagem amigável para o usuário final com base no tipo de erro.
   * @param error Erro capturado
   * @param defaultMessage Mensagem padrão se o erro não for reconhecido
   * @returns Uma mensagem amigável para o usuário
   */
  private static getFriendlyMessage(
    error: unknown,
    defaultMessage: string,
  ): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          return 'Um registro com essas informações já existe.'
        case 'P2025':
          return 'Registro não encontrado.'
        default:
          return 'Erro no banco de dados. Tente novamente.'
      }
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

  /**
   * Envia o erro para um sistema de monitoramento (e.g., Sentry, LogRocket, etc.)
   * @param error Erro capturado
   * @param context Contexto adicional do erro
   */
  private static sendToMonitoring(error: unknown, context?: string): void {
    if (process.env.NODE_ENV === 'production') {
      const Sentry = require('@sentry/node')
      Sentry.captureException(error, {
        tags: {context},
      })
    }
  }
}
