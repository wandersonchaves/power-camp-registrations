import type {Carnet, CarnetEfiData} from '@/types'

export function mapEfiPayDataToCarnet(
  data: CarnetEfiData,
  customerId: string,
): Carnet {
  if (!data.id || !data.carnet_id || !data.charges) {
    throw new Error('Dados do carnê incompletos ou inválidos.')
  }

  return {
    id: data.id,
    carnetId: data.carnet_id,
    customerId,
    status: data.status,
    cover: data.cover,
    link: data.link,
    carnetLink: data.carnet_link,
    repeats: data.repeats,
    value: data.value,
    customId: data.custom_id ?? undefined,
    createdAt: new Date(data.created_at),
    charges: data.charges.map((charge) => ({
      chargeId: charge.charge_id,
      parcel: charge.parcel,
      status: charge.status,
      value: charge.value,
      expireAt: charge.expire_at,
      url: charge.url,
      parcelLink: charge.parcel_link || '',
    })),
  }
}
