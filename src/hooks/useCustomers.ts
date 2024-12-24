'use client'

import {useCallback, useEffect, useState} from 'react'

import axiosLocal from '@/services/axiosLocal'
import type {Customer} from '@/types'

export const useCustomers = (initialPage: number = 1, limit: number = 10) => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [currentPage, setCurrentPage] = useState<number>(initialPage)
  const [filters, setFilters] = useState<{
    name?: string
    cpf?: string
    status?: string
  }>({})

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axiosLocal.get('/customers', {
        params: {
          page: currentPage,
          limit,
          ...filters,
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
  }, [currentPage, filters, limit])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const applyFilters = (newFilters: {
    name?: string
    cpf?: string
    status?: string
  }) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  const setPage = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  return {customers, loading, totalPages, currentPage, setPage, applyFilters}
}
