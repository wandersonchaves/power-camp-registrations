import {NextResponse} from 'next/server'

import axiosEfi from '@/services/axiosEfi'

export async function PUT(req: Request) {
  try {
    const {carnetId} = await req.json()

    if (!carnetId) {
      return NextResponse.json(
        {message: 'O ID do carnê é obrigatório.'},
        {status: 400},
      )
    }

    const response = await axiosEfi.put(`/carnet/${carnetId}/cancel`, {})

    return NextResponse.json(
      {message: 'Carnê cancelado com sucesso.'},
      {status: response.status},
    )
  } catch (error) {
    console.error('Erro ao cancelar carnê:', error)
    return NextResponse.json(
      {
        message: error || 'Erro ao cancelar o carnê. Verifique os dados.',
      },
      {status: 500},
    )
  }
}
