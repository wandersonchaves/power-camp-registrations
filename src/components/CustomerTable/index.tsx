import React from 'react'
import {CustomerStatusEnum} from '@prisma/client'

import {type Customer} from '@/types/Customer'
import {sanitizePhoneNumber} from '@/utils/phoneUtils'

interface CustomerTableProps {
  customers: Customer[]
  onConfirmCustomer?: (customer: Customer) => void
  onGenerateCarnet?: (customer: Customer) => void
  generatingCustomerId: string | null
}

// const getColorForStatus = (status: string): string => {
//   const statusMap: Record<string, string> = {
//     paid: 'bg-green-100 text-green-800',
//     settled: 'bg-green-100 text-green-800',
//     waiting: 'bg-yellow-100 text-yellow-800',
//     unpaid: 'bg-red-100 text-red-800',
//     contested: 'bg-yellow-100 text-yellow-800',
//     refunded: 'bg-yellow-100 text-yellow-800',
//     canceled: 'bg-yellow-100 text-yellow-800',
//   }
//   return statusMap[status] || 'bg-gray-100 text-gray-800'
// }

const getCustomerStatusDescription = (status: CustomerStatusEnum): string => {
  const descriptionMap: Record<CustomerStatusEnum, string> = {
    [CustomerStatusEnum.WAITING_LIST]: 'Lista de espera',
    [CustomerStatusEnum.CONFIRMED]: 'Confirmado',
    [CustomerStatusEnum.CANCELED]: 'Cancelado',
    [CustomerStatusEnum.INACTIVE]: 'Inativo',
    [CustomerStatusEnum.ACTIVE]: 'Ativo',
  }

  return descriptionMap[status] || 'Desconhecido'
}

const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  onConfirmCustomer,
  onGenerateCarnet,
  generatingCustomerId,
}) => {
  console.log('🚀 ~ customers:', customers)
  // const [chargeStatuses, setChargeStatuses] = useState<Record<string, string>>(
  //   {},
  // )
  // const [loading, setLoading] = useState(false)

  // const fetchChargeStatus = async (chargeId: number): Promise<string> => {
  //   try {
  //     const response = await fetch(`/api/charge/${chargeId}/status`)
  //     if (response.ok) {
  //       const {status} = await response.json()
  //       return status?.data?.status || 'Desconhecido'
  //     }
  //     return response.status === 404 ? 'Não encontrado' : 'Erro'
  //   } catch (error) {
  //     console.error(`Erro ao buscar status para charge ID ${chargeId}:`, error)
  //     return 'Erro'
  //   }
  // }

  // useEffect(() => {
  //   const fetchAllChargesStatus = async () => {
  //     setLoading(true)
  //     const statuses: Record<string, string> = {}

  //     for (const customer of customers) {
  //       for (const charge of customer.carnets?.[0]?.charges || []) {
  //         statuses[charge.chargeId] = await fetchChargeStatus(charge.chargeId)
  //       }
  //     }

  //     setChargeStatuses(statuses)
  //     setLoading(false)
  //   }

  //   fetchAllChargesStatus()
  // }, [customers])

  return (
    <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
      {/* {loading && (
        <p className="text-center text-sm text-gray-500">
          Carregando status...
        </p>
      )} */}
      <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
        <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th className="px-6 py-3">Nome</th>
            <th className="px-6 py-3">CPF</th>
            <th className="px-6 py-3">Email</th>
            <th className="px-6 py-3">Telefone</th>
            <th className="px-6 py-3">Parcelas</th>
            <th className="px-6 py-3">Carnê</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr
              key={customer.id}
              className="border-b bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              <th className="px-6 py-4">{customer.name}</th>
              <td className="px-6 py-4">{customer.cpf}</td>
              <td className="px-6 py-4">{customer.email || 'Não informado'}</td>
              <td className="px-6 py-4">
                {sanitizePhoneNumber(customer.phone || '') ?? (
                  <span className="text-red-500">Telefone inválido</span>
                )}
              </td>
              <td className="px-6 py-4">
                {customer.carnets?.[0]?.charges?.map((charge) => (
                  <span
                    key={charge.chargeId}
                    className={`inline-block rounded px-3 py-1 text-xs font-medium `}
                  >
                    {/* ${getColorForStatus(chargeStatuses[charge.chargeId] || 'Desconhecido',)} */}
                    {charge.parcel}
                  </span>
                )) || <span className="text-gray-500">Sem parcelas</span>}
              </td>
              {/* <td className="px-6 py-4">
                {customer.carnetGenerated ||
                customer.status === CustomerStatusEnum.CONFIRMED ? (
                  <>
                    <div>
                      <span className="font-medium">
                        Status: {getCustomerStatusDescription(customer.status)}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        window.open(customer.carnets?.[0]?.link, '_blank')
                      }
                      className="mt-1 rounded-lg bg-orange-400 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-500"
                    >
                      Ver Carnê
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onGenerateCarnet(customer)}
                    disabled={generatingCustomerId === customer.id}
                    className="mb-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
                  >
                    {generatingCustomerId === customer.id
                      ? 'Gerando...'
                      : 'Gerar Carnê'}
                  </button>
                )}
              </td> */}
              <td className="px-6 py-4">
                <div>
                  <span className="font-medium">
                    Status: {getCustomerStatusDescription(customer.status)}
                  </span>
                </div>

                {customer.status === CustomerStatusEnum.WAITING_LIST && (
                  <button
                    onClick={() => onConfirmCustomer?.(customer)}
                    className="mt-2 rounded-lg bg-green-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-600"
                  >
                    Confirmar Inscrição
                  </button>
                )}

                {customer.status === CustomerStatusEnum.CONFIRMED &&
                  customer.carnetGenerated &&
                  Array.isArray(customer.carnets) &&
                  customer.carnets.length > 0 && (
                    <button
                      onClick={() => {
                        const carnetLink = customer.carnets?.[0]?.link
                        if (carnetLink) {
                          window.open(carnetLink, '_blank')
                        } else {
                          alert('Link do carnê não encontrado.')
                        }
                      }}
                      className="mt-1 rounded-lg bg-orange-400 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-500"
                    >
                      Ver Carnê
                    </button>
                  )}

                {customer.status === CustomerStatusEnum.CONFIRMED &&
                  !customer.carnetGenerated && (
                    <button
                      onClick={() => onGenerateCarnet?.(customer)}
                      disabled={generatingCustomerId === customer.id}
                      className="mb-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
                    >
                      {generatingCustomerId === customer.id
                        ? 'Gerando...'
                        : 'Gerar Carnê'}
                    </button>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CustomerTable
