import {FC, useCallback, useEffect, useState} from 'react'
import axios from 'axios'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import Modal from '@/components/ui/modal'

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

  const fetchParcels = useCallback(async () => {
    if (!carnetId) {
      console.error('Carnet ID inválido')
      return
    }

    setLoading(true)

    try {
      const {data} = await axios.get(`/api/carnet/${carnetId}/details`)
      const fetchedParcels =
        data?.charges?.map((charge: Parcel) => ({
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

    try {
      const response = await axios.put(
        `/api/carnet/${carnetId}/parcel/${parcel}`,
        {expire_at: newDate},
      )

      if (response.status === 200 || response.status === 204) {
        alert('Data de vencimento atualizada com sucesso!')
        await fetchParcels() // Recarregar parcelas após atualização.
      } else {
        alert('Erro ao atualizar a data de vencimento. Tente novamente.')
      }
    } catch (error) {
      console.error('Erro ao atualizar data de vencimento:', error)
      alert('Erro ao atualizar a data de vencimento. Tente novamente.')
    } finally {
      setLoading(false)
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
      <h2 className="mb-4 text-lg font-bold">Detalhes das Parcelas</h2>
      {loading && <p>Carregando...</p>}
      {!loading && parcels.length === 0 && <p>Nenhuma parcela encontrada.</p>}
      <div className="space-y-4">
        {parcels.map((parcel) => (
          <div
            key={parcel.charge_id}
            className="flex items-center justify-between"
          >
            <span>
              Parcela {parcel.parcel} -{' '}
              {parcel.status === 'waiting' ? 'Pendente' : 'Paga'}
            </span>
            <Input
              type="date"
              defaultValue={parcel.expire_at.split('T')[0]}
              onBlur={(e) => handleDateChange(parcel.parcel, e.target.value)}
            />
            <a
              href={parcel.pdf?.charge}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Ver PDF
            </a>
          </div>
        ))}
      </div>
      <Button
        onClick={onClose}
        className="mt-4"
      >
        Fechar
      </Button>
    </Modal>
  )
}

export default ParcelDetailsModal
