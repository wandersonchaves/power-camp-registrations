import type {Charge} from './Charge'

export interface Carnet {
  customerId: string
  carnetId: number
  status: string
  cover: string
  link: string
  carnetLink: string
  repeats: number
  value: number
  customId: string | null
  charges: Charge[]
  createdAt: Date
}
