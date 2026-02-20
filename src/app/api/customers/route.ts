import {CustomerStatusEnum} from '@prisma/client'
import {NextRequest, NextResponse} from 'next/server'
import {getServerSession} from 'next-auth'

import {authOptions} from '../auth/[...nextauth]/auth-options'

import {prisma} from '@/lib/prisma'
import {customerSchema} from '@/schemas/customerSchema'
import {getCustomers} from '@/use-cases/customerService'

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const name = searchParams.get('name') || ''
    const cpf = searchParams.get('cpf') || ''
    const status = searchParams.get('status') || ''

    if (isNaN(page) || isNaN(limit) || page <= 0 || limit <= 0) {
      return NextResponse.json(
        {message: 'Parâmetros inválidos de paginação.'},
        {status: 400},
      )
    }

    const customersData = await getCustomers({page, limit, name, cpf, status})

    if (!customersData) {
      return NextResponse.json(
        {message: 'Nenhum cliente encontrado.'},
        {status: 404},
      )
    }

    const {customers, total, totalPages, currentPage} = customersData

    return NextResponse.json({
      data: customers,
      meta: {
        total,
        totalPages,
        currentPage,
      },
    })
  } catch (error) {
    console.error('Erro ao buscar clientes:', error)
    return NextResponse.json(
      {message: 'Erro interno no servidor.'},
      {status: 500},
    )
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        {message: 'Usuário não autenticado ou ID de usuário ausente.'},
        {status: 401},
      )
    }

    const userId = session.user.id
    const payload = await request.json()

    if (!payload) {
      return NextResponse.json(
        {message: 'O payload está vazio.'},
        {status: 400},
      )
    }

    const validatedData = customerSchema.parse(payload)

    const existingCustomer = await prisma.customer.findUnique({
      where: {cpf: validatedData.cpf},
    })

    if (existingCustomer) {
      return NextResponse.json(
        {
          message: 'Já existe um cliente com este CPF.',
          customer: existingCustomer,
        },
        {status: 409},
      )
    }

    const newCustomer = await prisma.customer.create({
      data: {
        ...validatedData,
        birthDate: validatedData.birthDate
          ? new Date(validatedData.birthDate)
          : null,
        status: validatedData.status ?? CustomerStatusEnum.WAITING_LIST,
        carnetGenerated: false,
        user: {connect: {id: userId}},
      },
    })

    return NextResponse.json(newCustomer, {status: 201})
  } catch (error) {
    console.error('Erro ao criar cliente:', error)
    return NextResponse.json(
      {message: 'Erro interno no servidor.'},
      {status: 500},
    )
  }
}
