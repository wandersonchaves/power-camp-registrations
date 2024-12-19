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
   * Gerencia erros de forma centralizada e personalizada.
   * @param asyncFn Função assíncrona envolvida pelo ErrorHandler.
   * @param options Configurações opcionais para o tratamento de erro.
   * @returns O resultado da função assíncrona ou `null` em caso de erro.
   */
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

  /**
   * Retorna uma mensagem amigável baseada no tipo de erro.
   * @param error Erro capturado.
   * @param defaultMessage Mensagem padrão caso o erro não seja reconhecido.
   * @returns Mensagem amigável para o usuário.
   */
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

  /**
   * Gera mensagens de erro específicas para erros do Prisma.
   * @param error Instância de erro do Prisma.
   * @returns Mensagem amigável do erro.
   */
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

  /**
   * Faz log do erro em um sistema de logs local ou remoto.
   * Substitui a necessidade de ferramentas externas como o Sentry.
   * @param error Erro capturado.
   * @param context Contexto adicional do erro.
   */
  private static logError(error: unknown, context?: string): void {
    const isProduction = process.env.NODE_ENV === 'production'

    const logDetails = {
      timestamp: new Date().toISOString(),
      context,
      error: this.serializeError(error),
    }

    if (isProduction) {
      // Simula envio para sistema de monitoramento (e.g., Logstash, AWS CloudWatch)
      console.log('[Log - Production]', JSON.stringify(logDetails))
    } else {
      // Log mais detalhado para desenvolvimento
      console.error('[Log - Development]', logDetails)
    }
  }

  /**
   * Serializa um erro para facilitar o log e depuração.
   * @param error Erro capturado.
   * @returns Objeto serializável do erro.
   */
  private static serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    if (typeof error === 'object' && error !== null) {
      return {...error} // Serializa objetos genéricos
    }

    return {error: String(error)} // Para tipos primitivos como string, number, etc.
  }
}
