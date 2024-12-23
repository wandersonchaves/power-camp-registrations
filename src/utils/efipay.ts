import axios from 'axios'

import {env} from '@/env.mjs'
import axiosEfi from '@/services/axiosEfi'

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
  // Verificação de token em cache e validade
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken
  }

  try {
    // Credenciais codificadas em Base64
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
      'base64',
    )

    // Autenticação com Efipay e geração do token
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

    // Atualização do token em cache e tempo de expiração
    cachedToken = access_token
    tokenExpiry = Date.now() + expires_in * 1000

    return access_token
  } catch (error) {
    console.error('Erro ao autenticar com Efipay:', error)
    throw new Error('Erro ao autenticar com Efipay.')
  }
}

export const cancelCarnet = async (carnetId: string): Promise<void> => {
  try {
    await axiosEfi.put(`/carnet/${carnetId}/cancel`)
  } catch (error) {
    handleAxiosError(error, `Erro ao cancelar o carnê: ${carnetId}`)
  }
}

export const getChargeStatus = async (chargeId: string) => {
  try {
    const response = await axiosEfi.get(`/charge/${chargeId}`)

    return response.data
  } catch (error) {
    handleAxiosError(error, `Erro ao obter o status da cobrança: ${chargeId}`)
  }
}

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
