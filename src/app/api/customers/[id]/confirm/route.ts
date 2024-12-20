import {NextResponse} from 'next/server'

import {prisma} from '@/lib/prisma'

export async function PUT(
  request: Request,
  {params}: {params: Promise<{id: string}>},
): Promise<Response> {
  try {
    // Aguarde o parâmetro dinâmico `id` ser resolvido.
    const {id} = await params

    if (!id) {
      return NextResponse.json(
        {error: 'ID do cliente é obrigatório.'},
        {status: 400},
      )
    }

    // Atualize o cliente no banco de dados para confirmar.
    const updatedCustomer = await prisma.customer.update({
      where: {id},
      data: {status: 'CONFIRMED'}, // Certifique-se de usar um valor válido para o status.
    })

    return NextResponse.json(updatedCustomer, {status: 200})
  } catch (error) {
    console.error('Erro ao confirmar cliente:', error)

    return NextResponse.json(
      {error: 'Erro ao confirmar cliente.'},
      {status: 500},
    )
  }
}
