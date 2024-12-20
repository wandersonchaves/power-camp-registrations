import {useState} from 'react'

import type {Carnet} from '@/types/Carnet'

export const useEfipay = () => {
  const [loading, setLoading] = useState(false)
  const [carnetData, setCarnetData] = useState<Carnet | null>(null)

  const fetchCarnetDetails = async (carnetId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/efipay/carnet/${carnetId}`)
      if (!response.ok) {
        throw new Error('Erro ao buscar detalhes do carnê.')
      }
      const data = await response.json()
      setCarnetData(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return {loading, carnetData, fetchCarnetDetails}
}
