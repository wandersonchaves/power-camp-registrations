import {Prisma} from '@prisma/client'

import {prisma} from '@/lib/prisma'
import type {Carnet, Charge, Customer} from '@/types'

interface GetCustomersParams {
  page?: number
  limit?: number
  name?: string
  cpf?: string
  status?: string
}

interface GetCustomersResponse {
  customers: Customer[]
  total: number
  currentPage: number
  totalPages: number
}

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

export const getCustomers = async ({
  page = 1,
  limit = 10,
  name = '',
  cpf = '',
  status = '',
}: GetCustomersParams): Promise<GetCustomersResponse | null> => {
  try {
    const skip = (page - 1) * limit

    const whereClause: Prisma.CustomerWhereInput = {
      AND: [
        ...(name
          ? [{name: {contains: name, mode: Prisma.QueryMode.insensitive}}]
          : []),
        ...(cpf
          ? [{cpf: {contains: cpf, mode: Prisma.QueryMode.insensitive}}]
          : []),
        ...(status === 'no_carnet'
          ? [
              {
                carnets: {
                  none: {},
                },
              },
            ]
          : status
            ? [
                {
                  carnets: {
                    some: {
                      status: {equals: status},
                    },
                  },
                },
              ]
            : []),
      ],
    }

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where: whereClause,
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
      prisma.customer.count({where: whereClause}),
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
