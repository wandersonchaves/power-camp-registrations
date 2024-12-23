'use client'

import {useCallback, useEffect, useState} from 'react'

import axiosLocal from '@/services/axiosLocal'
import type {Customer} from '@/types'

interface UseCustomersResult {
  customers: Customer[]
  loading: boolean
  totalPages: number
  currentPage: number
  setPage: (page: number) => void
  searchCustomers: (term: string) => void
}

export const useCustomers = (
  initialPage: number = 1,
  limit: number = 10,
): UseCustomersResult => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [currentPage, setCurrentPage] = useState<number>(initialPage)

  const fetchCustomers = useCallback(
    async (searchTerm: string = '') => {
      setLoading(true)

      try {
        const response = await axiosLocal.get('/customers', {
          params: {
            page: currentPage,
            limit,
            search: searchTerm,
          },
        })

        const {data, meta} = response.data

        setCustomers(data)
        setTotalPages(meta?.totalPages || 1)
      } catch (error) {
        console.error('Erro ao buscar clientes:', error)
      } finally {
        setLoading(false)
      }
    },
    [currentPage, limit],
  )

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const setPage = useCallback(
    (page: number) => {
      if (page > 0 && page <= totalPages) {
        setCurrentPage(page)
      }
    },
    [totalPages],
  )

  const searchCustomers = useCallback(
    (term: string) => {
      fetchCustomers(term)
    },
    [fetchCustomers],
  )

  return {customers, loading, totalPages, currentPage, setPage, searchCustomers}
}
