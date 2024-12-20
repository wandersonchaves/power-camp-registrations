import {NextResponse} from 'next/server'

import {cancelCarnet} from '@/utils/efipay'
import {ErrorHandler} from '@/utils/errorHandler'

export async function PUT(
  request: Request,
  {params}: {params: {carnetId: string}},
) {
  const {carnetId} = params

  if (!carnetId) {
    return NextResponse.json(
      {error: 'O carnet_id é obrigatório.'},
      {status: 400},
    )
  }

  return await ErrorHandler.handle(
    async () => {
      await cancelCarnet(carnetId)

      return NextResponse.json(
        {message: 'Carnê cancelado com sucesso.'},
        {status: 200},
      )
    },
    {
      context: `PUT /api/carnet/${carnetId}/cancel`,
      defaultErrorMessage: 'Erro ao cancelar o carnê.',
      returnHttpResponse: true,
    },
  )
}
