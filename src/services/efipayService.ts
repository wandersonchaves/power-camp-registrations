import EfiPay from 'sdk-typescript-apis-efi'

import {saveCarnetData} from './carnetService'

import efiConfig from '@/config/efiConfig'
import type {CustomerData} from '@/types/Customer'
import {mapEfiPayDataToCarnet} from '@/utils/mappers'
import {sanitizePhoneNumber} from '@/utils/phoneUtils'

const efipay = new EfiPay(efiConfig)

export const createCarnet = async (body: {
  items: {name: string; value: number; amount: number}[]
  customer: {name: string; cpf: string; phone_number: string}
  expire_at: string
  repeats: number
  split_items?: boolean
  message?: string
}) => {
  const sanitizedPhone = sanitizePhoneNumber(body.customer.phone_number)

  if (!sanitizedPhone) {
    throw new Error('Número de telefone inválido.')
  }

  try {
    const response = await efipay.createCarnet(
      {},
      {...body, customer: {...body.customer, phone_number: sanitizedPhone}},
    )

    const carnetData = response.data

    if (!carnetData?.charges) {
      throw new Error('Dados do Carnê inválidos ou incompletos.')
    }

    const carnet = mapEfiPayDataToCarnet(carnetData, 'customerId')
    await saveCarnetData(carnet, body.customer as CustomerData)

    return response
  } catch (error: unknown) {
    console.error('Erro ao criar o Carnê:', error)
    throw new Error('Erro ao criar o Carnê')
  }
}
