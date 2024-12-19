import {saveCarnetData} from '@/services/carnetService'
import {createCarnet} from '@/services/efipayService'
import {ErrorHandler} from '@/utils/errorHandler'
import {mapEfiPayDataToCarnet} from '@/utils/mappers'

export async function POST(req: Request): Promise<Response> {
  const response = await ErrorHandler.handle(
    async () => {
      const body = await req.json()

      if (!body.customer || typeof body.customer !== 'object') {
        return new Response(
          JSON.stringify({
            message: 'customer é obrigatório e deve ser um objeto válido.',
          }),
          {status: 400, headers: {'Content-Type': 'application/json'}},
        )
      }

      const carnetResponse = await createCarnet(body)
      const carnet = mapEfiPayDataToCarnet(carnetResponse.data, body.customerId)
      const carnetRecord = await saveCarnetData(carnet, body.customer)

      return new Response(
        JSON.stringify({
          message: 'Carnê gerado com sucesso',
          data: carnetRecord,
        }),
        {status: 201, headers: {'Content-Type': 'application/json'}},
      )
    },
    {
      context: 'POST /api/carnet',
    },
  )

  // Garantir que sempre retornamos um Response
  return (
    response ||
    new Response(
      JSON.stringify({
        message: 'Erro inesperado ocorreu.',
      }),
      {status: 500, headers: {'Content-Type': 'application/json'}},
    )
  )
}
