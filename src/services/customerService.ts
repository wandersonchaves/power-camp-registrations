import {CustomerStatusEnum} from '@prisma/client'

import {prisma} from '@/lib/prisma'
import type {Customer} from '@/types/Customer'

interface GetCustomersParams {
  page?: number
  limit?: number
}

interface GetCustomersResponse {
  customers: Customer[]
  total: number
  currentPage: number
  totalPages: number
}

export const getCustomers = async ({
  page = 1,
  limit = 10,
}: GetCustomersParams): Promise<GetCustomersResponse | null> => {
  try {
    const skip = (page - 1) * limit

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        skip,
        take: limit,
        orderBy: {createdAt: 'desc'},
        include: {
          carnets: {
            include: {
              charges: true,
            },
          },
        },
      }),
      prisma.customer.count(),
    ])

    const normalizedCustomers: Customer[] = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      cpf: customer.cpf,
      birthDate: customer.birthDate || undefined,
      phone: customer.phone || undefined,
      email: customer.email || undefined,
      address: customer.address || undefined,
      postalCode: customer.postalCode || undefined,
      spouseName: customer.spouseName || undefined,
      status: mapPrismaStatusToCustomerStatus(
        customer.status,
      ) as CustomerStatusEnum,
      carnetGenerated: customer.carnetGenerated,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      carnets: customer.carnets.map((carnet) => ({
        ...carnet,
        charges: carnet.charges.map((charge) => ({
          ...charge,
        })),
      })),
    }))

    return {
      customers: normalizedCustomers,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    }
  } catch (error) {
    console.error('Erro ao buscar clientes:', error)
    // Retorna null em caso de erro, garantindo o retorno
    return null
  }
}

// Função de mapeamento do status do Prisma para o sistema
export const mapPrismaStatusToCustomerStatus = (
  status: CustomerStatusEnum,
): CustomerStatusEnum => {
  switch (status) {
    case CustomerStatusEnum.WAITING_LIST:
      return CustomerStatusEnum.WAITING_LIST
    case CustomerStatusEnum.CONFIRMED:
      return CustomerStatusEnum.CONFIRMED
    case CustomerStatusEnum.CANCELED:
      return CustomerStatusEnum.CANCELED
    case CustomerStatusEnum.INACTIVE:
      return CustomerStatusEnum.INACTIVE
    case CustomerStatusEnum.ACTIVE:
      return CustomerStatusEnum.ACTIVE
    default:
      return CustomerStatusEnum.WAITING_LIST
  }
}
