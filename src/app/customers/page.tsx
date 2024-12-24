'use client'

import {useEffect, useState} from 'react'
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
import axiosLocal from '@/services/axiosLocal'
import type {Customer} from '@/types'
import {sanitizePhoneNumber} from '@/utils/phoneUtils'

const CustomersPage = () => {
  const {customers, loading, totalPages, currentPage, setPage, applyFilters} =
    useCustomers()
  const [filters, setFilters] = useState({
    name: '',
    cpf: '',
    status: '',
  })
  const [generatingCustomerId, setGeneratingCustomerId] = useState<
    string | null
  >(null)

  const syncCarnets = async () => {
    try {
      const response = await axiosLocal.post('/carnet/sync')
      if (response.status !== 200) {
        console.error('Erro ao sincronizar carnês:', response.data.message)
      }
    } catch (error) {
      console.error('Erro ao sincronizar carnês:', error)
    }
  }

  useEffect(() => {
    syncCarnets()
  }, [])

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const {name, value} = e.target
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleApplyFilters = () => {
    applyFilters(filters)
  }

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

    setGeneratingCustomerId(customer.id)

    try {
      // Configuração dos dados para a API
      const payload = {
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
      }

      // Chamada à API utilizando axiosLocal
      const response = await axiosLocal.post('/carnet', payload)

      if (response.status !== 201) {
        throw new Error('Erro ao gerar o carnê.')
      }

      alert('Carnê gerado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar carnê:', error)
      alert('Erro ao gerar o carnê.')
    } finally {
      setGeneratingCustomerId(null)
    }
  }

  const handleConfirmCustomer = async (customer: Customer) => {
    try {
      // Chamada à API utilizando axiosLocal
      const response = await axiosLocal.put(`/customers/${customer.id}/confirm`)

      // Valida a resposta da API
      if (response.status !== 200) {
        throw new Error('Erro ao confirmar o cliente.')
      }

      alert('Cliente confirmado com sucesso!')
    } catch (error) {
      console.error('Erro ao confirmar cliente:', error)
      alert('Erro ao confirmar cliente.')
    }
  }

  if (loading) {
    return <p>Carregando...</p>
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col items-center justify-between lg:flex-row">
        <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
          INSCRITOS
        </h1>
        <div className="mt-4 flex flex-col gap-4 lg:mt-0 lg:flex-row">
          <input
            type="text"
            name="name"
            placeholder="Nome"
            value={filters.name}
            onChange={handleFilterChange}
            className="rounded-lg border px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="text"
            name="cpf"
            placeholder="CPF"
            value={filters.cpf}
            onChange={handleFilterChange}
            className="rounded-lg border px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="rounded-lg border px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Todos</option>
            <option value="up_to_date">Em Dia</option>
            <option value="unpaid">Inadimplente</option>
            <option value="finished">Finalizado</option>
            <option value="no_carnet">Sem Carnê</option>
          </select>
          <button
            onClick={handleApplyFilters}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
          >
            Filtrar
          </button>
          <Link
            href="/customers/new"
            className="flex items-center rounded-lg bg-gray-400 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            Nova Inscrição
          </Link>
        </div>
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
