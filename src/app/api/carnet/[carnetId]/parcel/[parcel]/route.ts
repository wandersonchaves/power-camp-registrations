import axios from 'axios'
import {NextResponse} from 'next/server'

import {env} from '@/env.mjs'
import {getAuthorizationToken} from '@/utils/efipay'

export async function PUT(
  request: Request,
  context: {params: Promise<{carnetId: string; parcel: string}>},
): Promise<Response> {
  // Aguarde a resolução de `params` para acessar seus valores
  const {carnetId, parcel} = await context.params

  // Validação dos parâmetros
  if (!carnetId || !parcel) {
    return NextResponse.json(
      {error: 'Os parâmetros "carnetId" e "parcel" são obrigatórios.'},
      {status: 400},
    )
  }

  try {
    // Extrai o corpo da requisição
    const {expire_at} = await request.json()

    // Obtém o token de autorização
    const token = await getAuthorizationToken()

    // Configura a URL da API e os headers
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
