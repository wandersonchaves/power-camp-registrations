export interface Charge {
  chargeId: number
  parcel: number
  status: string
  value: number
  expireAt: Date
  url: string
  parcelLink: string
}
