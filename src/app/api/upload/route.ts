import {NextRequest} from 'next/server'
import {getServerSession} from 'next-auth/next'
import * as XLSX from 'xlsx'

import {authOptions} from '@/app/api/auth/[...nextauth]/auth-options'
import {prisma} from '@/lib/prisma'

interface CustomerRow {
  'NOME COMPLETO': string
  CPF: string
  'DATA DE NASCIMENTO'?: string
  'TELEFONE/WHATS'?: string | number
  'EMAIL DE CONTATO'?: string
  ENDEREÇO?: string
  CEP?: string | number
  'NOME COMPLETO DO CÔNJUGE'?: string
}

function sanitizeCpf(cpf: unknown): string | null {
  if (typeof cpf === 'number') {
    cpf = cpf.toString()
  }
  if (typeof cpf !== 'string' || !cpf) {
    return null
  }
  return cpf.replace(/\D/g, '')
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({
          message: 'Usuário não autenticado ou sessão inválida.',
        }),
        {status: 401, headers: {'Content-Type': 'application/json'}},
      )
    }

    const userId = session.user.id
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response(
        JSON.stringify({message: 'Nenhum arquivo foi enviado.'}),
        {status: 400, headers: {'Content-Type': 'application/json'}},
      )
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, {type: 'array'})
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<CustomerRow>(sheet)

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'O arquivo está vazio ou possui um formato inválido.',
        }),
        {status: 400, headers: {'Content-Type': 'application/json'}},
      )
    }

    const filteredCustomers = data.map((row) => {
      const cpf = sanitizeCpf(row.CPF)

      return {
        name: row['NOME COMPLETO'] || 'Nome não informado',
        cpf,
        birthDate: row['DATA DE NASCIMENTO']
          ? new Date(row['DATA DE NASCIMENTO'])
          : null,
        phone: row['TELEFONE/WHATS'] ? String(row['TELEFONE/WHATS']) : null,
        email: row['EMAIL DE CONTATO'] ?? null,
        address: row.ENDEREÇO ? String(row.ENDEREÇO) : null,
        postalCode: row.CEP ? String(row.CEP) : null,
        spouseName: row['NOME COMPLETO DO CÔNJUGE'] ?? null,
        userId,
      }
    })

    const results = []
    const errors = []

    for (const customer of filteredCustomers) {
      if (!customer.cpf || !/^\d{11}$/.test(customer.cpf)) {
        console.warn(`CPF inválido para o cliente: ${customer.name}`)
        continue
      }

      try {
        const result = await prisma.customer.upsert({
          where: {cpf: customer.cpf},
          update: {
            name: customer.name,
            birthDate: customer.birthDate || undefined,
            phone: customer.phone || undefined,
            email: customer.email || undefined,
            address: customer.address || undefined,
            postalCode: customer.postalCode || undefined,
            spouseName: customer.spouseName || undefined,
            userId,
          },
          create: {
            name: customer.name,
            cpf: customer.cpf,
            birthDate: customer.birthDate,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            postalCode: customer.postalCode,
            spouseName: customer.spouseName,
            userId: customer.userId,
            createdAt: new Date(),
          },
        })

        results.push(result)
      } catch (error) {
        console.error('Erro ao salvar registro:', customer, error)

        errors.push({
          customer,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Processamento concluído',
        successCount: results.length,
        errorCount: errors.length,
        errors,
      }),
      {status: 200, headers: {'Content-Type': 'application/json'}},
    )
  } catch (error) {
    console.error('Erro no processamento:', error)
    return new Response(
      JSON.stringify({message: 'Erro interno no servidor.'}),
      {status: 500, headers: {'Content-Type': 'application/json'}},
    )
  }
}
