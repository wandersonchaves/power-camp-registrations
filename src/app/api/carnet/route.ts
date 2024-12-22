import {NextResponse} from 'next/server'

import {saveCarnetData} from '@/services/carnetService'
import {createCarnet} from '@/services/efipayService'
import {mapEfiPayDataToCarnet} from '@/utils/mappers'
import {transformCustomerDataToCustomer} from '@/utils/transformers'
import {validateCreateChargeBody} from '@/utils/validators'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json()

    // Valida a estrutura do corpo da requisição
    validateCreateChargeBody(body)

    // Transforma os dados do cliente para o formato interno
    const customer = transformCustomerDataToCustomer(body.customer)

    // Chama o serviço para criar o carnê
    const carnetResponse = await createCarnet(body)

    if (!carnetResponse.data) {
      throw new Error('Resposta inválida da API. Dados ausentes.')
    }

    // Ajusta os dados do carnê
    const carnetData = {
      id: carnetResponse.data.carnet_id.toString(),
      carnet_id: carnetResponse.data.carnet_id,
      status: carnetResponse.data.status,
      cover: carnetResponse.data.cover,
      link: carnetResponse.data.link,
      carnet_link: carnetResponse.data.carnet_link,
      charges: carnetResponse.data.charges.map((charge) => ({
        charge_id: charge.charge_id,
        parcel: charge.parcel,
        status: charge.status,
        value: charge.value,
        expire_at: new Date(charge.expire_at),
        url: charge.url,
        parcel_link: charge.parcel_link,
      })),
      repeats: body.repeats,
      value: body.items.reduce(
        (total: number, item: {value: number}) => total + item.value,
        0,
      ),
      custom_id: null,
      created_at: new Date(),
    }

    // Mapeia os dados para o formato interno
    const carnet = mapEfiPayDataToCarnet(carnetData, customer.id)

    // Salva os dados do carnê no banco
    const carnetRecord = await saveCarnetData(carnet, customer)

    return NextResponse.json(
      {
        message: 'Carnê gerado com sucesso.',
        data: carnetRecord,
      },
      {status: 201},
    )
  } catch (error) {
    console.error('Erro ao gerar o carnê:', error)
    return NextResponse.json({message: 'Erro ao gerar o carnê.'}, {status: 500})
  }
}
