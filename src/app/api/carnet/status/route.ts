import {NextResponse} from 'next/server'

import {prisma} from '@/lib/prisma'

export async function PUT(req: Request): Promise<Response> {
  try {
    const {carnetId, status} = await req.json()

    // Atualiza o status do carnê no banco de dados
    const updatedCarnet = await prisma.carnet.update({
      where: {carnetId},
      data: {status},
    })

    return NextResponse.json({
      message: 'Status do carnê atualizado com sucesso.',
      data: updatedCarnet,
    })
  } catch (error) {
    console.error('Erro ao atualizar status do carnê:', error)
    return NextResponse.json(
      {message: 'Erro ao atualizar status do carnê.'},
      {status: 500},
    )
  }
}
