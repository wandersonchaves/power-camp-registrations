import {FC, useCallback, useEffect, useState} from 'react'
import Link from 'next/link'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import Modal from '@/components/ui/modal'
import axiosLocal from '@/use-cases/axiosLocal'

interface Parcel {
  charge_id: number
  parcel: number
  expire_at: string
  status: string
  url: string
  pdf: {
    charge: string
  }
  pix: {
    qrcode: string
    qrcode_image: string
  }
}

interface ParcelDetailsModalProps {
  carnetId: number
  isOpen: boolean
  onClose: () => void
}

const ParcelDetailsModal: FC<ParcelDetailsModalProps> = ({
  carnetId,
  isOpen,
  onClose,
}) => {
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingParcels, setUpdatingParcels] = useState<Set<number>>(new Set())

  const fetchParcels = useCallback(async () => {
    if (!carnetId) {
      console.error('Carnet ID inválido')
      return
    }

    setLoading(true)

    try {
      const {data} = await axiosLocal.get(`/carnet/${carnetId}/details`)
      const fetchedParcels =
        data?.data?.charges?.map((charge: Parcel) => ({
          charge_id: charge.charge_id,
          parcel: charge.parcel,
          expire_at: charge.expire_at,
          status: charge.status,
          url: charge.url,
          pdf: charge.pdf,
          pix: charge.pix,
        })) || []

      setParcels(fetchedParcels)
    } catch (error) {
      console.error('Erro ao buscar parcelas:', error)
      setParcels([])
    } finally {
      setLoading(false)
    }
  }, [carnetId])

  const handleDateChange = async (parcel: number, newDate: string) => {
    if (!carnetId || !parcel || !newDate) {
      alert('Erro: Dados inválidos para atualizar a data de vencimento.')
      return
    }

    setLoading(true)
    if (updatingParcels.has(parcel)) {
      console.warn(`Atualização já em andamento para a parcela ${parcel}`)
      return
    }

    setUpdatingParcels((prev) => new Set(prev).add(parcel))

    try {
      const response = await axiosLocal.put(
        `/carnet/${carnetId}/parcel/${parcel}`,
        {expire_at: newDate},
      )

      if (response.status === 200 || response.status === 204) {
        alert('Data de vencimento atualizada com sucesso!')
        await fetchParcels()
      } else {
        alert('Erro ao atualizar a data de vencimento. Tente novamente.')
      }
    } catch (error) {
      console.error('Erro ao atualizar data de vencimento:', error)
      alert('Erro ao atualizar a data de vencimento. Tente novamente.')
    } finally {
      setLoading(false)
      setUpdatingParcels((prev) => {
        const updatedSet = new Set(prev)
        updatedSet.delete(parcel)
        return updatedSet
      })
    }
  }

  useEffect(() => {
    if (isOpen) fetchParcels()
  }, [isOpen, fetchParcels])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="flex items-center justify-between rounded-t border-b p-2 md:p-3 dark:border-gray-600">
        <h2 className="text-4xl font-bold text-black dark:text-gray-800">
          Detalhes das Parcelas
        </h2>
      </div>
      {loading && <p>Carregando...</p>}
      {!loading && parcels.length === 0 && <p>Nenhuma parcela encontrada.</p>}
      <div className="space-y-4 p-4 md:p-5">
        <ul className="max-w-md divide-y divide-gray-200 dark:divide-gray-700">
          {parcels.map((parcel) => (
            <li
              key={parcel.charge_id}
              className="flex flex-col justify-between space-y-2 py-3 sm:flex-row sm:items-center sm:space-y-0 sm:py-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 rtl:space-x-reverse">
                <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  Parcela {parcel.parcel}
                </span>
                <span className="text-sm font-medium">
                  {(() => {
                    switch (parcel.status) {
                      case 'waiting':
                        return <span className="text-yellow-500">Pendente</span>
                      case 'paid':
                        return <span className="text-green-500">Paga</span>
                      case 'canceled':
                      case 'cancelled':
                        return <span className="text-red-500">Cancelada</span>
                      case 'unpaid':
                        return (
                          <span className="text-red-500">Inadimplente</span>
                        )
                      default:
                        return (
                          <span className="text-gray-500">
                            Status Desconhecido
                          </span>
                        )
                    }
                  })()}
                </span>
              </div>

              <div className="flex items-center">
                <Input
                  type="date"
                  defaultValue={parcel.expire_at.split('T')[0]}
                  onBlur={(e) =>
                    handleDateChange(parcel.parcel, e.target.value)
                  }
                  disabled={updatingParcels.has(parcel.parcel)}
                  className="text-sm text-gray-700 dark:text-white"
                />
              </div>

              <div className="flex items-center">
                <Link
                  href={parcel.pdf?.charge}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-600"
                >
                  Ver PDF
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center rounded-b border-t border-gray-200 p-2 md:p-3 dark:border-gray-600">
        <Button
          onClick={onClose}
          className="mt-4"
        >
          Fechar
        </Button>
      </div>
    </Modal>
  )
}

export default ParcelDetailsModal
