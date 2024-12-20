import axios from 'axios'
import {NextResponse} from 'next/server'

import {env} from '@/env.mjs'
import {getAuthorizationToken} from '@/utils/efipay'

export async function PUT(
  req: Request,
  {params}: {params: {carnetId: string; parcel: string}},
): Promise<Response> {
  const {carnetId, parcel} = params

  if (!carnetId || !parcel) {
    return NextResponse.json(
      {
        message: 'Parâmetros inválidos: carnetId e parcel são obrigatórios.',
      },
      {status: 400},
    )
  }

  try {
    const {expire_at} = await req.json()

    if (!expire_at) {
      return NextResponse.json(
        {message: 'O campo expire_at é obrigatório.'},
        {status: 400},
      )
    }

    const token = await getAuthorizationToken()
    const API_BASE_URL = env.EFI_API_BASE_URL

    const response = await axios.put(
      `${API_BASE_URL}/carnet/${carnetId}/parcel/${parcel}`,
      {expire_at},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    return NextResponse.json(
      {
        message: 'Data de vencimento atualizada com sucesso!',
        data: response.data,
      },
      {status: 200},
    )
  } catch (error) {
    console.error('Erro interno no servidor:', error)

    return NextResponse.json(
      {
        message: 'Erro interno no servidor.',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      {status: 500},
    )
  }
}
