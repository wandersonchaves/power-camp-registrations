// src/app/api/customers/[id]/confirm/route.ts
import {NextResponse} from 'next/server'

import {prisma} from '@/lib/prisma'

export async function PUT(req: Request, {params}: {params: {id: string}}) {
  const {id} = params

  if (!id) {
    return NextResponse.json(
      {error: 'ID do cliente é obrigatório.'},
      {status: 400},
    )
  }

  try {
    const updatedCustomer = await prisma.customer.update({
      where: {id},
      data: {status: 'CONFIRMED'}, // Certifique-se de usar o valor correto do status.
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
