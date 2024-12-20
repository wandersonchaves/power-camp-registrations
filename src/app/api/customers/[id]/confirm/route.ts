import {NextResponse} from 'next/server'

import {prisma} from '@/lib/prisma'

export async function PUT(
  request: Request,
  {params}: {params: Promise<{id: string}>},
): Promise<Response> {
  try {
    const {id} = await params

    if (!id) {
      return NextResponse.json(
        {error: 'ID do cliente é obrigatório.'},
        {status: 400},
      )
    }

    const updatedCustomer = await prisma.customer.update({
      where: {id},
      data: {status: 'CONFIRMED'},
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
