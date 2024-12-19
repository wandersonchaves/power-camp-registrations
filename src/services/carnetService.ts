import {prisma} from '@/lib/prisma'
import type {Carnet} from '@/types/Carnet'
import type {CustomerData} from '@/types/Customer'
import {ErrorHandler} from '@/utils/errorHandler'

export const saveCarnetData = async (
  carnet: Carnet,
  customer: CustomerData,
) => {
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

    const normalizedCharges = carnet.charges.map((charge) => ({
      chargeId: charge.chargeId,
      parcel: charge.parcel,
      status: charge.status,
      value: charge.value,
      expireAt: charge.expireAt,
      url: charge.url,
      parcelLink: charge.parcelLink,
    }))

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
