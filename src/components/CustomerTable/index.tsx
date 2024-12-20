import {useState} from 'react'
import {CustomerStatusEnum} from '@prisma/client'

import ParcelDetailsModal from '../Modals/ParcelDetailsModal'

import type {Customer} from '@/types/Customer'

interface CustomerTableProps {
  customers: Customer[]
  onConfirmCustomer?: (customer: Customer) => void
  onGenerateCarnet?: (customer: Customer) => void
  generatingCustomerId: string | null
}

const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  onConfirmCustomer,
  onGenerateCarnet,
  generatingCustomerId,
}) => {
  const [selectedCarnetId, setSelectedCarnetId] = useState<number | null>(null)

  const handleOpenModal = (carnetId: number | undefined) => {
    if (carnetId) {
      setSelectedCarnetId(carnetId)
    } else {
      alert('Carnê não encontrado.')
    }
  }

  const handleCloseModal = () => {
    setSelectedCarnetId(null)
  }

  const getCustomerActions = (customer: Customer) => {
    const actions = []
    const carnet = customer.carnets?.[0]

    if (customer.status === CustomerStatusEnum.WAITING_LIST) {
      actions.push(
        <button
          key="confirm"
          onClick={() => onConfirmCustomer?.(customer)}
          className="mt-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
        >
          Confirmar Inscrição
        </button>,
      )
    }

    if (customer.status === CustomerStatusEnum.CONFIRMED) {
      if (customer.carnetGenerated && carnet) {
        actions.push(
          <button
            key="view-carnet"
            onClick={() => {
              if (carnet.link) {
                window.open(carnet.link, '_blank')
              } else {
                alert('Link do carnê não encontrado.')
              }
            }}
            className="mt-1 rounded-lg bg-orange-400 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
          >
            Ver Carnê
          </button>,
        )
      } else {
        actions.push(
          <button
            key="generate-carnet"
            onClick={() => onGenerateCarnet?.(customer)}
            disabled={generatingCustomerId === customer.id}
            className="mt-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            {generatingCustomerId === customer.id
              ? 'Gerando...'
              : 'Gerar Carnê'}
          </button>,
        )
      }
    }

    if (carnet && carnet.id) {
      actions.push(
        <button
          key="view-parcels"
          onClick={() => handleOpenModal(carnet.carnetId)}
          className="mt-1 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Detalhes das Parcelas
        </button>,
      )
    }

    return actions
  }

  return (
    <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
      <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
        <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th className="px-6 py-3">Nome</th>
            <th className="px-6 py-3">CPF</th>
            <th className="px-6 py-3">Email</th>
            <th className="px-6 py-3">Telefone</th>
            <th className="px-6 py-3">Ações</th>
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
                {customer.phone || (
                  <span className="text-red-500">Telefone inválido</span>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  {getCustomerActions(customer)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedCarnetId && (
        <ParcelDetailsModal
          carnetId={selectedCarnetId}
          isOpen={!!selectedCarnetId}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}

export default CustomerTable
