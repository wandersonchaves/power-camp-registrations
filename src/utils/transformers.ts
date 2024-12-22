import type {Customer, CustomerData} from '@/types'

/**
 * Transforma os dados de `CustomerData` para `Customer`.
 * @param data - Dados do cliente no formato da API.
 * @returns Dados do cliente no formato interno.
 */
export const transformCustomerDataToCustomer = (
  data: CustomerData,
): Customer => ({
  id: '',
  name: data.name,
  cpf: data.cpf,
  phone: data.phone_number,
  email: data.email || '',
  address: data.address || '',
  postalCode: data.postal_code || '',
  birthDate: data.birth_date ? new Date(data.birth_date) : undefined,
  spouseName: data.spouse_name || '',
  status: 'ACTIVE',
  carnetGenerated: false,
  carnets: [],
})
