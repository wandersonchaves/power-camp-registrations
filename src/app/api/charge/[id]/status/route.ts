import {NextResponse} from 'next/server'

import {getAuthorizationToken, getChargeStatus} from '@/utils/efipay'
import {ErrorHandler} from '@/utils/errorHandler'

export async function GET(request: Request, context: {params: {id: string}}) {
  return await ErrorHandler.handle(
    async () => {
      // Aguardar explicitamente os parâmetros
      const {id: chargeId} = await context.params

      if (!chargeId) {
        return NextResponse.json(
          {error: 'O charge_id é obrigatório.'},
          {status: 400},
        )
      }

      const token = await getAuthorizationToken()

      if (!token) {
        return NextResponse.json(
          {error: 'Token de autorização não encontrado ou inválido.'},
          {status: 401},
        )
      }

      const status = await getChargeStatus(chargeId, token)

      return NextResponse.json({status}, {status: 200})
    },
    {
      context: `GET /api/charge/[id]/status`,
      defaultErrorMessage: 'Erro ao obter o status da parcela.',
      returnHttpResponse: true,
    },
  )
}
