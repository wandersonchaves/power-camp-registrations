import type {CustomerStatusEnum} from '@prisma/client'

import type {Carnet} from './Carnet'

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
