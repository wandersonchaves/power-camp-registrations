import {AxiosError} from 'axios'
import {NextResponse} from 'next/server'

import axiosEfi from '@/services/axiosEfi'

export async function GET(
  _req: Request,
  context: {params: Promise<{carnetId: string}>},
): Promise<Response> {
  try {
    const {carnetId} = await context.params

    if (!carnetId) {
      return NextResponse.json(
        {message: 'ID do carnê é obrigatório.'},
        {status: 400},
      )
    }

    const response = await axiosEfi.get(`/carnet/${carnetId}`)

    return NextResponse.json(response.data, {status: 200})
  } catch (error) {
    console.error('Erro ao buscar detalhes do carnê:', error)

    if (error instanceof AxiosError) {
      return NextResponse.json(
        {
          message: 'Erro ao buscar detalhes do carnê.',
          details: error.message,
        },
        {status: error.response?.status || 500},
      )
    }

    return NextResponse.json(
      {message: 'Erro desconhecido ao buscar detalhes do carnê.'},
      {status: 500},
    )
  }
}
