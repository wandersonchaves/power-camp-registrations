import axios from 'axios'
import {NextResponse} from 'next/server'

import type {Carnet} from '@/types/Carnet'
import {getAuthorizationToken} from '@/utils/efipay'

export async function GET(
  _request: Request,
  {params}: {params: {carnetId: string}},
) {
  try {
    const token = await getAuthorizationToken()
    const {carnetId} = params

    const response = await axios.get(
      `https://cobrancas-h.api.efipay.com.br/v1/carnet/${carnetId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const data: Carnet = response.data // Tipar os dados da API
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter carnê:', error)
    return NextResponse.json({error: 'Erro ao obter carnê'}, {status: 500})
  }
}
