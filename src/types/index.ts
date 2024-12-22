import type {CustomerStatusEnum} from '@prisma/client'

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
  email?: string
  address?: string
  postal_code?: string
  birth_date?: string
  spouse_name?: string
}

export interface Carnet {
  id: string
  customerId: string
  carnetId: number
  status: string
  cover: string
  link: string
  carnetLink: string
  repeats: number
  value: number
  customId?: string
  charges: Charge[]
  createdAt: Date
}

export interface Charge {
  chargeId: number
  parcel: number
  status: string
  value: number
  expireAt: Date
  url: string
  parcelLink?: string
}

export interface EfiPayConfig {
  sandbox: boolean
  client_id: string
  client_secret: string
  certificate: string
}

export interface ChargeEfiData {
  charge_id: number
  parcel: number
  status: string
  value: number
  expire_at: Date
  url: string
  parcel_link: string
}

export interface CarnetEfiData {
  id: string
  carnet_id: number
  status: string
  cover: string
  link: string
  carnet_link: string
  repeats: number
  value: number
  custom_id: string | null
  charges: ChargeEfiData[]
  created_at: Date
}
