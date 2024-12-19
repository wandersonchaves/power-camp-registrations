import {CustomerStatusEnum} from '@prisma/client'
import {NextResponse} from 'next/server'
import {getServerSession} from 'next-auth'

import {authOptions} from '../auth/[...nextauth]/auth-options'

import {prisma} from '@/lib/prisma'
import {customerSchema} from '@/schemas/customerSchema'
import {getCustomers} from '@/services/customerService'
import {ErrorHandler} from '@/utils/errorHandler'

export async function GET(request: Request) {
  return ErrorHandler.handle(
    async () => {
      const {searchParams} = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1', 10)
      const limit = parseInt(searchParams.get('limit') || '10', 10)

      if (isNaN(page) || isNaN(limit) || page <= 0 || limit <= 0) {
        return NextResponse.json(
          {message: 'Parâmetros inválidos de paginação.'},
          {status: 400},
        )
      }

      const customersData = await getCustomers({page, limit})

      if (!customersData || !customersData.customers) {
        return NextResponse.json(
          {message: 'Nenhum dado de cliente encontrado.'},
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
    },
    {context: 'GET /api/customers'},
  )
}

export async function POST(request: Request) {
  return ErrorHandler.handle(
    async () => {
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
          {error: 'O payload está vazio.'},
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
    },
    {context: 'POST /api/customers'},
  )
}
