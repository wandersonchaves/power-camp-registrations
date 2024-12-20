import axios, {AxiosError} from 'axios'
import {NextResponse} from 'next/server'

import {env} from '@/env.mjs'
import {getAuthorizationToken} from '@/utils/efipay'

export async function GET(
  _req: Request,
  {params}: {params: {carnetId: string}},
): Promise<Response> {
  try {
    const {carnetId} = await params

    if (!carnetId) {
      return NextResponse.json(
        {message: 'ID do carnê é obrigatório.'},
        {status: 400},
      )
    }

    const token = await getAuthorizationToken()
    const API_BASE_URL = env.EFI_API_BASE_URL

    const response = await axios.get(`${API_BASE_URL}/carnet/${carnetId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return NextResponse.json(response.data)
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
