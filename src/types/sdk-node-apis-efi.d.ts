declare module 'sdk-node-apis-efi' {
  interface EfiPayConfig {
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

  interface EfiPayResponse {
    code: number
    data: EfiPayData
  }

  interface ChargeItem {
    name: string
    value: number
    amount: number
  }

  interface CustomerData {
    name: string
    cpf: string
    phone_number: string
  }

  interface CreateChargeBody {
    items: ChargeItem[]
    customer: CustomerData
    expire_at: string
    repeats: number
    message?: string
  }

  export interface EfiPayData {
    carnet_id: number
    status: string
    cover: string
    link: string
    carnet_link: string
    charges: Array<{
      charge_id: number
      parcel: number
      status: string
      value: number
      expire_at: string
      url: string
      parcel_link: string
    }>
    pdf: {
      carnet: string
      cover: string
    }
  }

  export default class EfiPay {
    constructor(config: EfiPayConfig)
    createCarnet(
      params: object,
      body: CreateChargeBody,
    ): Promise<EfiPayResponse>
  }
}
