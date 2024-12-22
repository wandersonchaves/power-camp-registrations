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
