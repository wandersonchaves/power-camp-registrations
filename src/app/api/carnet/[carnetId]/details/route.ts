import axios, {AxiosError} from 'axios'
import {NextResponse} from 'next/server'

import {env} from '@/env.mjs'
import {getAuthorizationToken} from '@/utils/efipay'

export async function GET(
  _req: Request,
  {params}: {params: Promise<{carnetId: string}>},
): Promise<Response> {
  try {
    const {carnetId} = await params // Aguardar o objeto params

    console.log('🚀 ~ carnetId:', carnetId)

    if (!carnetId) {
      return NextResponse.json(
        {message: 'ID do carnê é obrigatório.'},
        {status: 400},
      )
    }

    const token = await getAuthorizationToken()
    console.log('🚀 ~ token:', token)
    const API_BASE_URL = env.EFI_API_BASE_URL
    console.log('🚀 ~ API_BASE_URL:', API_BASE_URL)

    const response = await axios.get(`${API_BASE_URL}/carnet/${carnetId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return NextResponse.json(response.data, {status: 200})
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Erro ao buscar detalhes do carnê (Axios):', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      })

      return NextResponse.json(
        {message: 'Erro ao buscar detalhes do carnê.', details: error.message},
        {status: error.response?.status || 500},
      )
    }

    if (error instanceof Error) {
      console.error('Erro genérico:', error.message)

      return NextResponse.json(
        {
          message: 'Erro inesperado ao buscar detalhes do carnê.',
          details: error.message,
        },
        {status: 500},
      )
    }

    console.error('Erro desconhecido:', error)

    return NextResponse.json(
      {message: 'Erro desconhecido ao buscar detalhes do carnê.'},
      {status: 500},
    )
  }
}
