import {Prisma} from '@prisma/client'

import {prisma} from '@/lib/prisma'
import type {Carnet, Charge, Customer} from '@/types'

interface GetCustomersParams {
  page?: number
  limit?: number
  search?: string
}

interface GetCustomersResponse {
  customers: Customer[]
  total: number
  currentPage: number
  totalPages: number
}

/**
 * Normaliza os dados do cliente retornados pelo Prisma para alinhar com as tipagens esperadas.
 * @param customer - Dados do cliente retornados pelo Prisma.
 * @returns Cliente normalizado.
 */
const normalizeCustomer = (
  customer: Prisma.CustomerGetPayload<{
    include: {
      carnets: {
        include: {
          charges: true
        }
      }
    }
  }>,
): Customer => ({
  id: customer.id,
  name: customer.name,
  cpf: customer.cpf,
  birthDate: customer.birthDate || undefined,
  phone: customer.phone || undefined,
  email: customer.email || undefined,
  address: customer.address || undefined,
  postalCode: customer.postalCode || undefined,
  spouseName: customer.spouseName || undefined,
  status: customer.status,
  carnetGenerated: customer.carnetGenerated,
  carnets: customer.carnets.map(
    (carnet): Carnet => ({
      id: carnet.id,
      customerId: customer.id,
      carnetId: carnet.carnetId,
      status: carnet.status,
      cover: carnet.cover,
      link: carnet.link,
      carnetLink: carnet.carnetLink,
      repeats: carnet.repeats,
      value: carnet.value,
      customId: carnet.customId || undefined,
      createdAt: carnet.createdAt,
      charges: carnet.charges.map(
        (charge): Charge => ({
          chargeId: charge.chargeId,
          parcel: charge.parcel,
          status: charge.status,
          value: charge.value,
          expireAt: charge.expireAt,
          url: charge.url,
          parcelLink: charge.parcelLink || '',
        }),
      ),
    }),
  ),
})

/**
 * Obtém os clientes com paginação e condições de pesquisa.
 * @param params - Parâmetros para buscar os clientes.
 * @returns Dados dos clientes e informações de paginação.
 */
export const getCustomers = async ({
  page = 1,
  limit = 10,
  search = '',
}: GetCustomersParams): Promise<GetCustomersResponse | null> => {
  try {
    const skip = (page - 1) * limit

    const searchCondition: Prisma.CustomerWhereInput | undefined = search
      ? {
          OR: [
            {name: {contains: search, mode: 'insensitive'}},
            {cpf: {contains: search, mode: 'insensitive'}},
          ],
        }
      : undefined

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where: searchCondition,
        skip,
        take: limit,
        orderBy: {name: 'asc'},
        include: {
          carnets: {
            include: {
              charges: true,
            },
          },
        },
      }),
      prisma.customer.count({
        where: searchCondition,
      }),
    ])

    const normalizedCustomers = customers.map(normalizeCustomer)

    return {
      customers: normalizedCustomers,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    }
  } catch (error) {
    console.error('Erro ao buscar clientes:', error)
    return null
  }
}
