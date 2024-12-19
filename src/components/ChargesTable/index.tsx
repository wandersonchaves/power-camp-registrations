import React from 'react'

interface Charge {
  chargeId: string
  parcel: number
  status: string
  value: number
  expireAt: string
}

interface ChargesTableProps {
  charges: Charge[]
  onEdit: (chargeId: string) => void
}

export default function ChargesTable({charges, onEdit}: ChargesTableProps) {
  return (
    <table className="min-w-full border border-gray-300">
      <thead>
        <tr>
          <th>Parcela</th>
          <th>Status</th>
          <th>Valor</th>
          <th>Data de Vencimento</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {charges.map((charge) => (
          <tr key={charge.chargeId}>
            <td>{charge.parcel}</td>
            <td>{charge.status}</td>
            <td>{(charge.value / 100).toFixed(2)}</td>
            <td>{new Date(charge.expireAt).toLocaleDateString()}</td>
            <td>
              <button
                className="rounded bg-blue-500 px-4 py-2 text-white"
                onClick={() => onEdit(charge.chargeId)}
              >
                Editar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
