'use client'

import {useState} from 'react'
import Link from 'next/link'

import CustomerTable from '@/components/CustomerTable'
import Pagination from '@/components/Pagination'
import {
  DEFAULT_MESSAGE,
  EXPIRATION_DATE,
  INSTALLMENT_VALUE,
  INSTALLMENTS,
  TRAVEL_SERVICE_NAME,
} from '@/config/constants'
import {useCustomers} from '@/hooks/useCustomers'
import type {Customer} from '@/types/Customer'
import {sanitizePhoneNumber} from '@/utils/phoneUtils'

const CustomersPage = () => {
  const {customers, loading, totalPages, currentPage, setPage} = useCustomers()
  const [generatingCustomerId, setGeneratingCustomerId] = useState<
    string | null
  >(null)

  const handleGenerateCarnet = async (customer: {
    id: string
    name: string
    cpf: string
    email?: string
    phone?: string
  }) => {
    const sanitizedPhone = sanitizePhoneNumber(customer.phone ?? '')

    if (!sanitizedPhone) {
      alert(`Número de telefone inválido para o cliente: ${customer.name}`)
      console.error(`Telefone inválido: ${customer.phone}`)
      return
    }

    try {
      setGeneratingCustomerId(customer.id)

      const response = await fetch('/api/carnet', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          items: [
            {name: TRAVEL_SERVICE_NAME, value: INSTALLMENT_VALUE, amount: 1},
          ],
          customer: {
            name: customer.name,
            cpf: customer.cpf,
            email: customer.email,
            phone_number: sanitizedPhone,
          },
          expire_at: EXPIRATION_DATE,
          repeats: INSTALLMENTS,
          message: DEFAULT_MESSAGE,
        }),
      })

      if (!response.ok) throw new Error('Erro ao gerar o carnê')

      await response.json()
      alert('Carnê gerado com sucesso!')
    } catch (error) {
      alert('Erro ao gerar o carnê')
      console.error('Erro ao gerar o carnê:', error)
    } finally {
      setGeneratingCustomerId(null)
    }
  }

  const handleConfirmCustomer = async (customer: Customer) => {
    try {
      const response = await fetch(`/api/customers/${customer.id}/confirm`, {
        method: 'PUT',
      })

      if (!response.ok) {
        throw new Error('Erro ao confirmar o cliente.')
      }

      const updatedCustomer = await response.json()
      alert('Cliente confirmado com sucesso!')
      console.log('Cliente atualizado:', updatedCustomer)
    } catch (error) {
      console.error('Erro ao confirmar cliente:', error)
      alert('Erro ao confirmar cliente.')
    }
  }

  if (loading) {
    return <p>Carregando clientes...</p>
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between">
        <h1 className="mb-4 text-lg font-bold leading-none tracking-tight text-gray-900 md:text-5xl lg:text-4xl dark:text-white">
          INSCRITOS
        </h1>
        <Link
          href="/customers/new"
          className="mb-2 me-2 flex items-center rounded-lg bg-gray-400 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          Nova Inscrição
        </Link>
      </div>
      <CustomerTable
        customers={customers}
        onConfirmCustomer={handleConfirmCustomer}
        onGenerateCarnet={handleGenerateCarnet}
        generatingCustomerId={generatingCustomerId}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  )
}

export default CustomersPage
