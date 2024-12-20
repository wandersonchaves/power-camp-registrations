import {CustomerStatusEnum} from '@prisma/client'

import {prisma} from '@/lib/prisma'
import type {Customer} from '@/types/Customer'

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
 * Mapeia o status do Prisma para o status usado pelo sistema.
 * @param status Status do Prisma
 * @returns Status mapeado
 */
export const mapPrismaStatusToCustomerStatus = (
  status: CustomerStatusEnum,
): CustomerStatusEnum => {
  const statusMap: Record<CustomerStatusEnum, CustomerStatusEnum> = {
    [CustomerStatusEnum.WAITING_LIST]: CustomerStatusEnum.WAITING_LIST,
    [CustomerStatusEnum.CONFIRMED]: CustomerStatusEnum.CONFIRMED,
    [CustomerStatusEnum.CANCELED]: CustomerStatusEnum.CANCELED,
    [CustomerStatusEnum.INACTIVE]: CustomerStatusEnum.INACTIVE,
    [CustomerStatusEnum.ACTIVE]: CustomerStatusEnum.ACTIVE,
  }

  return statusMap[status] || CustomerStatusEnum.WAITING_LIST
}

/**
 * Obtém uma lista de clientes com paginação e suporte a busca.
 * @param params Parâmetros de busca e paginação
 * @returns Lista de clientes e metadados de paginação
 */
export const getCustomers = async ({
  page = 1,
  limit = 10,
  search = '',
}: GetCustomersParams): Promise<GetCustomersResponse | null> => {
  try {
    const skip = (page - 1) * limit

    // Condição de busca por nome ou CPF
    const searchCondition = search
      ? {
          OR: [
            {name: {contains: search, mode: 'insensitive' as const}},
            {cpf: {contains: search, mode: 'insensitive' as const}},
          ],
        }
      : undefined

    // Executa consultas em transação para eficiência
    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where: searchCondition,
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
      prisma.customer.count({
        where: searchCondition,
      }),
    ])

    // Normaliza os dados retornados
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
      status: mapPrismaStatusToCustomerStatus(customer.status),
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
    return null // Garante que o retorno é consistente
  }
}
