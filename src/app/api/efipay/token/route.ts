import {NextResponse} from 'next/server'

import {getAuthorizationToken} from '@/utils/efipay'

export async function GET() {
  try {
    const token = await getAuthorizationToken()
    return NextResponse.json({token})
  } catch (error) {
    console.error('Erro ao obter token Efipay:', error)
    return NextResponse.json(
      {error: 'Erro ao obter token Efipay'},
      {status: 500},
    )
  }
}
