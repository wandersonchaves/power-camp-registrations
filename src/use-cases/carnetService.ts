import axios from 'axios'

import axiosLocal from './axiosLocal'

import {prisma} from '@/lib/prisma'
import type {Carnet, Customer} from '@/types'
import {ErrorHandler} from '@/utils/errorHandler'

export const saveCarnetData = async (carnet: Carnet, customer: Customer) => {
  return ErrorHandler.handle(async () => {
    if (!carnet || !customer) {
      throw new Error('Carnet ou Customer não podem ser nulos.')
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: {cpf: customer.cpf},
    })

    if (!existingCustomer) {
      throw new Error(`Inscrito com CPF ${customer.cpf} não encontrado.`)
    }

    await prisma.customer.update({
      where: {cpf: customer.cpf},
      data: {carnetGenerated: true},
    })

    const normalizedCharges = carnet.charges.map((charge) => {
      if (!charge || typeof charge !== 'object') {
        throw new Error('Dados inválidos encontrados em charges.')
      }

      return {
        chargeId: charge.chargeId,
        parcel:
          typeof charge.parcel === 'number'
            ? charge.parcel
            : parseInt(charge.parcel, 10),
        status: charge.status,
        value: charge.value,
        expireAt: new Date(charge.expireAt),
        url: charge.url,
        parcelLink: charge.parcelLink || '',
      }
    })

    // Validação adicional
    if (!normalizedCharges || !Array.isArray(normalizedCharges)) {
      throw new Error('Charges normalizados são inválidos.')
    }

    // Validação de objeto antes de processar
    if (!normalizedCharges || !Array.isArray(normalizedCharges)) {
      throw new Error('Charges normalizados são inválidos.')
    }

    return prisma.carnet.upsert({
      where: {carnetId: carnet.carnetId},
      create: {
        carnetId: carnet.carnetId,
        status: carnet.status,
        repeats: carnet.repeats,
        value: carnet.value,
        cover: carnet.cover,
        link: carnet.link,
        carnetLink: carnet.carnetLink,
        customerId: existingCustomer.id,
        charges: {
          create: normalizedCharges,
        },
      },
      update: {
        status: carnet.status,
        value: carnet.value,
        cover: carnet.cover,
        link: carnet.link,
        carnetLink: carnet.carnetLink,
      },
    })
  })
}

export const updateCarnetStatus = async (
  carnetId: number,
  status: 'cancelled',
): Promise<void> => {
  try {
    await axiosLocal.put('/carnet/status', {carnetId, status})
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        'Erro ao atualizar o status do carnê no banco de dados:',
        error.response?.data || error.message,
      )
    } else {
      console.error('Erro inesperado:', error)
    }
    throw new Error('Erro ao atualizar o status do carnê.')
  }
}

/**
 * Serviço para cancelar um carnê via a rota de API do Next.js.
 * @param carnetId - O ID do carnê a ser cancelado.
 * @returns Mensagem de sucesso ou erro.
 */
export const cancelCarnet = async (carnetId: number): Promise<string> => {
  try {
    const {data} = await axiosLocal.put('/carnet/cancel', {carnetId})
    return data.message
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        'Erro ao cancelar carnê:',
        error.response?.data || error.message,
      )
      throw new Error(
        error.response?.data?.message || 'Erro ao cancelar o carnê.',
      )
    } else {
      console.error('Erro desconhecido ao cancelar carnê:', error)
      throw new Error('Erro desconhecido ao cancelar o carnê.')
    }
  }
}
