import {NextResponse} from 'next/server'

import {saveCarnetData} from '@/services/carnetService'
import {createCarnet} from '@/services/efipayService'
import {ErrorHandler} from '@/utils/errorHandler'
import {mapEfiPayDataToCarnet} from '@/utils/mappers'

export async function POST(req: Request) {
  return ErrorHandler.handle(async () => {
    const body = await req.json()

    if (!body.customer || typeof body.customer !== 'object') {
      return NextResponse.json(
        {message: 'customer é obrigatório e deve ser um objeto válido.'},
        {status: 400},
      )
    }

    const carnetResponse = await createCarnet(body)
    const carnet = mapEfiPayDataToCarnet(carnetResponse.data, body.customerId)

    const carnetRecord = await saveCarnetData(carnet, body.customer)

    return NextResponse.json(
      {
        message: 'Carnê gerado com sucesso',
        data: carnetRecord,
      },
      {status: 201},
    )
  })
}
