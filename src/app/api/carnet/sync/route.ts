import {NextResponse} from 'next/server'

import {prisma} from '@/lib/prisma'
import axiosEfi from '@/services/axiosEfi'

export async function POST(): Promise<Response> {
  try {
    // Buscar todos os carnês no banco local
    const localCarnets = await prisma.carnet.findMany({
      include: {
        charges: true,
      },
    })

    // Sincronizar dados
    for (const carnet of localCarnets) {
      try {
        const {data: apiCarnet} = await axiosEfi.get(
          `/carnet/${carnet.carnetId}`,
        )

        // Verificar divergências no carnê
        if (
          carnet.status !== apiCarnet.data.status ||
          carnet.value !== apiCarnet.data.value ||
          carnet.repeats !== apiCarnet.data.repeats
        ) {
          await prisma.carnet.update({
            where: {carnetId: carnet.carnetId},
            data: {
              status: apiCarnet.data.status,
              value: apiCarnet.data.value,
              repeats: apiCarnet.data.repeats,
            },
          })
        }

        // Validar se charges é um array antes de iterar
        const charges = Array.isArray(apiCarnet.data.charges)
          ? apiCarnet.data.charges
          : []

        for (const apiCharge of charges) {
          const localCharge = carnet.charges.find(
            (charge) => charge.chargeId === apiCharge.charge_id,
          )

          // Garantir que `value` seja um número válido
          const chargeValue = apiCharge.value
          if (chargeValue === undefined || isNaN(chargeValue)) {
            console.error(
              `Erro: Valor inválido encontrado para a cobrança ${apiCharge.charge_id}`,
            )
            continue
          }

          if (
            !localCharge ||
            localCharge.status !== apiCharge.status ||
            new Date(localCharge.expireAt).toISOString() !== apiCharge.expire_at
          ) {
            try {
              await prisma.charge.upsert({
                where: {
                  chargeId: apiCharge.charge_id,
                },
                update: {
                  status: apiCharge.status,
                  expireAt: new Date(apiCharge.expire_at),
                  value: chargeValue,
                },
                create: {
                  chargeId: apiCharge.charge_id,
                  parcel: apiCharge.parcel,
                  status: apiCharge.status,
                  expireAt: new Date(apiCharge.expire_at),
                  carnetId: carnet.id,
                  url: apiCharge.url,
                  value: chargeValue,
                },
              })
            } catch (upsertError) {
              console.error(
                `Erro ao atualizar/insertar a cobrança ${apiCharge.charge_id}:`,
                upsertError,
              )
            }
          }
        }
      } catch (error) {
        console.error(`Erro ao sincronizar carnê ${carnet.carnetId}:`, error)
      }
    }

    return NextResponse.json(
      {message: 'Sincronização concluída com sucesso.'},
      {status: 200},
    )
  } catch (error) {
    console.error('Erro ao sincronizar carnês:', error)
    return NextResponse.json(
      {message: 'Erro ao sincronizar carnês.'},
      {status: 500},
    )
  }
}
