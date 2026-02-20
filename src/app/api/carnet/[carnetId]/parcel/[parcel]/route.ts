import {NextResponse} from 'next/server'

import axiosEfi from '@/use-cases/axiosEfi'

export async function PUT(
  request: Request,
  context: {params: Promise<{carnetId: string; parcel: number}>},
): Promise<Response> {
  const {carnetId, parcel} = await context.params

  if (!carnetId || !parcel) {
    return NextResponse.json(
      {error: 'Os parâmetros "carnetId" e "parcel" são obrigatórios.'},
      {status: 400},
    )
  }

  try {
    const {expire_at} = await request.json()

    const response = await axiosEfi.put(
      `/carnet/${carnetId}/parcel/${parcel}`,
      {
        expire_at,
      },
    )

    return NextResponse.json(
      {
        message: 'Data de vencimento atualizada com sucesso.',
        data: response.data,
      },
      {status: 200},
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido'

    console.error(
      `Erro ao atualizar a parcela "${parcel}" do carnê "${carnetId}":`,
      errorMessage,
    )

    return NextResponse.json(
      {error: 'Erro interno ao processar a requisição.', details: errorMessage},
      {status: 500},
    )
  }
}
