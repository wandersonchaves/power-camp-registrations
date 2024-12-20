import type {CustomerStatusEnum} from '@prisma/client'

import type {Carnet} from './Carnet'

// export enum CustomerStatusEnum {
//   WAITING_LIST = 'WAITING_LIST',
//   CONFIRMED = 'CONFIRMED',
//   CANCELED = 'CANCELED',
//   INACTIVE = 'INACTIVE',
//   ACTIVE = 'ACTIVE',
// }

export interface Customer {
  id: string
  name: string
  cpf: string
  birthDate?: Date
  phone?: string
  email?: string
  address?: string
  postalCode?: string
  spouseName?: string
  status: CustomerStatusEnum
  carnetGenerated: boolean

  carnets?: Carnet[]
}

export interface CustomerData {
  name: string
  cpf: string
  phone_number: string
}
