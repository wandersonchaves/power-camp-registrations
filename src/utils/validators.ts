import type {CreateChargeBody} from 'sdk-node-apis-efi'

/**
 * Valida se o corpo da requisição é do tipo `CreateChargeBody`.
 * @param body - Dados a serem validados.
 * @throws Erro se os dados não forem válidos.
 */
export function validateCreateChargeBody(
  body: unknown,
): asserts body is CreateChargeBody {
  if (!isCreateChargeBody(body)) {
    throw new Error('Dados inválidos para a criação do carnê.')
  }
}

/**
 * Verifica se os dados fornecidos são do tipo `CreateChargeBody`.
 * @param body - Dados a serem verificados.
 * @returns Verdadeiro se os dados forem válidos.
 */
export function isCreateChargeBody(body: unknown): body is CreateChargeBody {
  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as CreateChargeBody).items) ||
    typeof (body as CreateChargeBody).customer !== 'object' ||
    typeof (body as CreateChargeBody).expire_at !== 'string' ||
    typeof (body as CreateChargeBody).repeats !== 'number'
  ) {
    return false
  }
  return true
}
