import type {CreateChargeBody, EfiPayResponse} from 'sdk-node-apis-efi'
import EfiPay from 'sdk-node-apis-efi'

import {toSnakeCase} from '@/utils/caseConverter'
import {validateCreateChargeBody} from '@/utils/validators'

export async function createCarnet(body: unknown): Promise<EfiPayResponse> {
  try {
    validateCreateChargeBody(body)

    const sanitizedBody = toSnakeCase<CreateChargeBody>(
      body as CreateChargeBody,
    )

    const efiPay = new EfiPay({
      sandbox: process.env.EFI_SANDBOX === 'true',
      client_id: process.env.EFI_CLIENT_ID || '',
      client_secret: process.env.EFI_CLIENT_SECRET || '',
      certificate: process.env.EFI_CERTIFICATE || '',
    })

    const response = await efiPay.createCarnet({}, sanitizedBody)

    if (!response || !response.data) {
      console.error('Resposta inválida da API EfiPay:', response)
      throw new Error('Resposta da API EfiPay inválida ou ausente.')
    }

    return response
  } catch (error) {
    console.error('Erro ao criar carnê via EfiPay:', error)
    throw new Error('Erro ao criar o carnê. Verifique os dados fornecidos.')
  }
}
