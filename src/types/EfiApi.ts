export interface ApiRequest<T> {
  data: T
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  error?: string
}
