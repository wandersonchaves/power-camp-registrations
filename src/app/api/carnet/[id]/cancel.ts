import {NextResponse} from 'next/server'

import {cancelCarnet, getAuthorizationToken} from '@/utils/efipay'
import {ErrorHandler} from '@/utils/errorHandler'

interface RequestParams {
  params: {id: string}
}

export async function PUT(request: Request, {params}: RequestParams) {
  const {id: carnetId} = params

  if (!carnetId) {
    return NextResponse.json(
      {error: 'O carnet_id é obrigatório.'},
      {status: 400},
    )
  }

  return await ErrorHandler.handle(
    async () => {
      const token = await getAuthorizationToken()
      await cancelCarnet(carnetId, token)

      return NextResponse.json(
        {message: 'Carnê cancelado com sucesso.'},
        {status: 200},
      )
    },
    {
      context: `PUT /api/carnet/${carnetId}`,
      defaultErrorMessage: 'Erro ao cancelar o carnê.',
      returnHttpResponse: true,
    },
  )
}
