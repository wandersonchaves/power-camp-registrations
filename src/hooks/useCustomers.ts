'use client'

import {useCallback, useEffect, useState} from 'react'

import type {Customer} from '@/types/Customer'
import {ErrorHandler} from '@/utils/errorHandler'

interface UseCustomersResult {
  customers: Customer[]
  loading: boolean
  totalPages: number
  currentPage: number
  setPage: (page: number) => void
}

export const useCustomers = (
  initialPage: number = 1,
  limit: number = 10,
): UseCustomersResult => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [currentPage, setCurrentPage] = useState<number>(initialPage)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)

    try {
      await ErrorHandler.handle(
        async () => {
          const response = await fetch(
            `/api/customers?page=${currentPage}&limit=${limit}`,
          )
          if (!response.ok) {
            throw new Error(`Failed to fetch customers: ${response.status}`)
          }

          const {data, meta} = await response.json()

          setCustomers(data)
          setTotalPages(meta?.totalPages || 1)
        },
        {
          context: 'useCustomers',
        },
      )
    } finally {
      setLoading(false)
    }
  }, [currentPage, limit])

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

  return {customers, loading, totalPages, currentPage, setPage}
}
