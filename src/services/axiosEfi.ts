import axios from 'axios'

import {env} from '@/env.mjs'
import {getAuthorizationToken} from '@/utils/efipay'

const axiosEfi = axios.create({
  baseURL: env.EFI_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor para adicionar o token de autorização
axiosEfi.interceptors.request.use(async (config) => {
  try {
    const token = await getAuthorizationToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (error) {
    console.error('Erro ao obter o token de autorização:', error)
    throw new Error('Falha ao adicionar o token de autorização')
  }
  return config
})

export default axiosEfi
