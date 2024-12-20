import axios from 'axios'

import {env} from '@/env.mjs'

const API_BASE_URL =
  env.EFI_API_BASE_URL ?? 'https://cobrancas-h.api.efipay.com.br/v1'
const AUTH_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://cobrancas.api.efipay.com.br/v1/authorize'
    : 'https://cobrancas-h.api.efipay.com.br/v1/authorize'

const CLIENT_ID = env.EFI_CLIENT_ID
const CLIENT_SECRET = env.EFI_CLIENT_SECRET

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
    console.error('Erro ao autenticar com Efipay:', error)
    throw new Error('Erro ao autenticar com Efipay.')
  }
}
/**
 * Cancela um carnê específico pelo ID
 * @param carnetId - ID do carnê
 */
export const cancelCarnet = async (carnetId: string): Promise<void> => {
  try {
    const token = await getAuthorizationToken()

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
  } catch (error) {
    handleAxiosError(error, `Erro ao cancelar o carnê: ${carnetId}`)
  }
}

/**
 * Obtém o status de uma cobrança específica
 * @param chargeId - ID da cobrança
 * @returns Status da cobrança
 */
export const getChargeStatus = async (chargeId: string) => {
  try {
    const token = await getAuthorizationToken()

    const response = await axios.get(`${API_BASE_URL}/charge/${chargeId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    return response.data
  } catch (error) {
    handleAxiosError(error, `Erro ao obter o status da cobrança: ${chargeId}`)
  }
}

/**
 * Manipula erros do Axios de forma genérica
 * @param error - Erro capturado
 * @param customMessage - Mensagem customizada para log
 */
const handleAxiosError = (error: unknown, customMessage: string): void => {
  if (axios.isAxiosError(error)) {
    console.error(customMessage, {
      message: error.message,
      code: error.code,
      response: error.response?.data,
    })
    throw new Error('Erro de requisição HTTP')
  } else if (error instanceof Error) {
    console.error(customMessage, {message: error.message})
    throw error
  } else {
    console.error(customMessage, error)
    throw new Error('Ocorreu um erro inesperado')
  }
}
