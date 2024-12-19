import axios from 'axios'

const API_BASE_URL =
  process.env.EFI_API_BASE_URL ?? 'https://cobrancas-h.api.efipay.com.br/v1'

const AUTH_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://cobrancas.api.efipay.com.br/v1/authorize'
    : 'https://cobrancas-h.api.efipay.com.br/v1/authorize'

const CLIENT_ID = process.env.EFI_CLIENT_ID || ''
const CLIENT_SECRET = process.env.EFI_CLIENT_SECRET || ''

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error('As credenciais da Efipay não estão configuradas.')
}

let cachedToken: string | null = null
let tokenExpiry: number | null = null

export const getAuthorizationToken = async (): Promise<string> => {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken
  }

  try {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
      'base64',
    )
    const response = await axios.post(
      AUTH_URL,
      {grant_type: 'client_credentials'},
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const {access_token, expires_in} = response.data
    cachedToken = access_token
    tokenExpiry = Date.now() + expires_in * 1000

    return access_token
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Erro ao fazer a requisição:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      })
      throw new Error('Erro de requisição HTTP')
    } else if (error instanceof Error) {
      console.error('Erro genérico:', error.message)
      throw error
    } else {
      console.error('Erro desconhecido:', error)
      throw new Error('Ocorreu um erro inesperado')
    }
  }
}

export const cancelCarnet = async (
  carnetId: string,
  token: string,
): Promise<void> => {
  await axios.put(
    `${API_BASE_URL}/carnet/${carnetId}/cancel`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  )
}

export const getChargeStatus = async (chargeId: string, token: string) => {
  const response = await axios.get(
    `https://cobrancas-h.api.efipay.com.br/v1/charge/${chargeId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  )

  return response.data
}
