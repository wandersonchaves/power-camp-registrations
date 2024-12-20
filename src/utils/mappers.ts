import type {CarnetEfiData} from 'sdk-typescript-apis-efi'

import type {Carnet} from '@/types/Carnet'
import type {Charge} from '@/types/Charge'

export const mapEfiPayDataToCarnet = (
  data: CarnetEfiData,
  customerId: string,
): Carnet => {
  const charges: Charge[] = Array.isArray(data.charges)
    ? data.charges.map((charge) => ({
        chargeId: charge.charge_id,
        parcel: Number(charge.parcel) || 0,
        status: charge.status || 'unknown',
        value: charge.value || 0,
        expireAt: charge.expire_at ? new Date(charge.expire_at) : new Date(),
        url: charge.url || '#',
        parcelLink: charge.parcel_link || '#',
      }))
    : []

  return {
    id: data.id,
    carnetId: data.carnet_id,
    customerId,
    status: data.status || 'pending',
    cover: data.cover || '',
    link: data.link || '',
    carnetLink: data.carnet_link || '',
    repeats: data.repeats || 1,
    value: data.value || 0,
    customId: data.custom_id ?? null,
    createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    charges,
  }
}
