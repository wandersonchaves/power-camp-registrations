import {useEffect, useState} from 'react'
import {CustomerStatusEnum} from '@prisma/client'

import ParcelDetailsModal from '../Modals/ParcelDetailsModal'

import {cancelCarnet, updateCarnetStatus} from '@/services/carnetService'
import type {Customer} from '@/types'

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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [cancelingCarnetId, setCancelingCarnetId] = useState<number | null>(
    null,
  )

  const handleOpenModal = (carnetId: number | undefined) => {
    if (carnetId) {
      setSelectedCarnetId(carnetId)
    } else {
      alert('Carnê não encontrado.')
    }
  }

  const handleCloseModal = () => setSelectedCarnetId(null)

  const toggleDropdown = (customerId: string) => {
    setOpenDropdown((prev) => (prev === customerId ? null : customerId))
  }

  const handleOutsideClick = (event: MouseEvent) => {
    const dropdown = document.getElementById(`dropdown-${openDropdown}`)
    if (dropdown && !dropdown.contains(event.target as Node)) {
      setOpenDropdown(null)
    }
  }

  useEffect(() => {
    if (openDropdown !== null) {
      document.addEventListener('click', handleOutsideClick)
    } else {
      document.removeEventListener('click', handleOutsideClick)
    }

    return () => {
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [openDropdown])

  const handleCancelCarnet = async (carnetId: number) => {
    setCancelingCarnetId(carnetId)
    try {
      const message = await cancelCarnet(carnetId)
      alert(message)
      await updateCarnetStatus(carnetId, 'cancelled')
    } catch (error) {
      console.error('Erro ao cancelar carnê:', error)
      alert('Erro ao cancelar o carnê. Verifique os dados e tente novamente.')
    } finally {
      setCancelingCarnetId(null)
    }
  }

  const renderActionsDropdown = (customer: Customer) => {
    const carnet = customer.carnets?.[0]

    const actions = [
      customer.status === CustomerStatusEnum.WAITING_LIST && (
        <button
          key="confirm"
          onClick={() => onConfirmCustomer?.(customer)}
          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-600"
        >
          Confirmar Inscrição
        </button>
      ),
      customer.status === CustomerStatusEnum.CONFIRMED &&
        !customer.carnetGenerated && (
          <button
            key="generate-carnet"
            onClick={() => onGenerateCarnet?.(customer)}
            disabled={generatingCustomerId === customer.id}
            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-600"
          >
            {generatingCustomerId === customer.id
              ? 'Gerando...'
              : 'Gerar Carnê'}
          </button>
        ),
      carnet?.link && (
        <button
          key="view-carnet"
          onClick={() => window.open(carnet.link, '_blank')}
          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-600"
        >
          Ver Carnê
        </button>
      ),
      carnet && (
        <button
          key="view-parcels"
          onClick={() => handleOpenModal(carnet.carnetId)}
          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-600"
        >
          Detalhes das Parcelas
        </button>
      ),
      carnet && (
        <button
          key="cancel-carnet"
          onClick={() => handleCancelCarnet(carnet.carnetId)}
          disabled={cancelingCarnetId === carnet.carnetId}
          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-600"
        >
          {cancelingCarnetId === carnet.carnetId
            ? 'Cancelando...'
            : 'Cancelar Carnê'}
        </button>
      ),
    ].filter(Boolean)

    return actions.length > 0 ? (
      <div className="relative">
        {/* <button
          onClick={() => toggleDropdown(customer.id)}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          Ações
        </button> */}
        <button
          onClick={() => toggleDropdown(customer.id)}
          id="dropdownMenuIconHorizontalButton"
          data-dropdown-toggle="dropdownDotsHorizontal"
          className="inline-flex items-center rounded-lg bg-white p-2 text-center text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-600"
          type="button"
        >
          <svg
            className="size-5"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 16 3"
          >
            <path d="M2 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6.041 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM14 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
          </svg>
        </button>
        {openDropdown === customer.id && (
          <div
            id={`dropdown-${customer.id}`}
            className="ring-opacity/5 absolute right-0 z-50 mt-2 w-44 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black focus:outline-none dark:bg-gray-800"
          >
            <div className="py-1">{actions}</div>
          </div>
        )}
      </div>
    ) : null
  }

  const getFinancialStatus = (customer: Customer) => {
    if (!customer.carnets || customer.carnets.length === 0) {
      return <span className="text-red-500">Sem Carnê</span>
    }

    const carnet = customer.carnets[0]

    // Verifica se o status do carnê é "cancelled"
    if (carnet.status === 'cancelled') {
      return <span className="text-gray-500">Cancelado</span>
    }

    // Filtra somente as parcelas vencidas que não estão pagas
    const overdueUnpaidCharges = carnet.charges.filter((charge) => {
      const isOverdue = new Date(charge.expireAt) < new Date()
      const isUnpaid = charge.status !== 'paid'
      return isOverdue && isUnpaid
    })
    console.log(
      '🚀 ~ overdueUnpaidCharges ~ overdueUnpaidCharges:',
      overdueUnpaidCharges,
    )

    if (overdueUnpaidCharges.length > 0) {
      return <span className="text-yellow-500">Inadimplente</span>
    }

    // Verifica se todas as parcelas vencidas estão pagas
    const allChargesPaid = carnet.charges.every((charge) => {
      const isOverdue = new Date(charge.expireAt) < new Date()
      const isPaid = charge.status === 'paid'
      return !isOverdue || isPaid
    })

    if (allChargesPaid) {
      return <span className="text-green-500">Em Dia</span>
    }

    return <span className="text-gray-500">Sem Informação</span>
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
            <th className="px-6 py-3">Status</th>
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
              <td className="px-6 py-4">{getFinancialStatus(customer)}</td>
              <td className="px-6 py-4">{renderActionsDropdown(customer)}</td>
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
