import {NextResponse} from 'next/server'
import {getServerSession} from 'next-auth/next'
import * as XLSX from 'xlsx'

import {authOptions} from '@/app/api/auth/[...nextauth]/auth-options'
import {prisma} from '@/lib/prisma'
import {ErrorHandler} from '@/utils/errorHandler'

interface CustomerRow {
  'NOME COMPLETO': string
  CPF: string
  'DATA DE NASCIMENTO'?: string
  'TELEFONE/WHATS'?: string | number
  'EMAIL DE CONTATO'?: string
  ENDEREÇO?: string
  CEP?: string | number
  'NOME COMPLETO DO CÔNJUGE'?: string
  Pontuação?: number | string
  'Carimbo de data/hora'?: string
}

function sanitizeCpf(cpf: unknown): string {
  if (typeof cpf === 'number') {
    cpf = cpf.toString()
  }

  if (typeof cpf !== 'string' || !cpf) {
    return ''
  }

  return cpf.replace(/\D/g, '')
}

export async function POST(req: Request) {
  return await ErrorHandler.handle(
    async () => {
      const session = await getServerSession(authOptions)

      if (!session || !session.user || !session.user.id) {
        return NextResponse.json(
          {message: 'Usuário não autenticado ou sessão inválida.'},
          {status: 401},
        )
      }

      const userId = session.user.id

      const formData = await req.formData()
      const file = formData.get('file') as File

      if (!file) {
        return NextResponse.json(
          {message: 'Nenhum arquivo foi enviado.'},
          {status: 400},
        )
      }

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, {type: 'array'})
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<CustomerRow>(sheet)

      if (!Array.isArray(data) || data.length === 0) {
        return NextResponse.json(
          {message: 'O arquivo está vazio ou possui um formato inválido.'},
          {status: 400},
        )
      }

      const validCustomers = data.map((row) => {
        const rawCpf = row['CPF'] || null
        const cpf = sanitizeCpf(rawCpf)

        const isCpfValid = cpf && /^\d{11}$/.test(cpf)

        return {
          name: row['NOME COMPLETO'] || 'Nome não informado',
          cpf: isCpfValid ? cpf : null,
          birthDate: row['DATA DE NASCIMENTO']
            ? new Date(row['DATA DE NASCIMENTO'])
            : null,
          phone: row['TELEFONE/WHATS'] ? String(row['TELEFONE/WHATS']) : null,
          email: row['EMAIL DE CONTATO'] ?? null,
          address: row['ENDEREÇO'] ? String(row['ENDEREÇO']) : null,
          postalCode: row['CEP'] ? String(row['CEP']) : null,
          spouseName: row['NOME COMPLETO DO CÔNJUGE'] ?? null,
          userId,
        }
      })

      const filteredCustomers = validCustomers.filter((customer) => {
        if (!customer.cpf) {
          console.warn(`Registro ignorado: CPF inválido para ${customer.name}`)
          return false
        }
        return true
      })

      const results = []
      const errors = []

      for (const customer of filteredCustomers) {
        if (!customer.cpf || customer.cpf.trim() === '') {
          console.warn(`CPF inválido para o cliente: ${customer.name}`)
          continue
        }

        if (typeof customer.address !== 'string' && customer.address !== null) {
          console.warn(`Endereço inválido para ${customer.name}`)
          customer.address = null
        }

        try {
          const result = await prisma.customer.upsert({
            where: {cpf: customer.cpf},
            update: {
              name: {set: customer.name},
              birthDate: customer.birthDate
                ? {set: customer.birthDate}
                : undefined,
              phone: customer.phone ? {set: customer.phone} : undefined,
              email: customer.email ? {set: customer.email} : undefined,
              address: customer.address ? {set: customer.address} : undefined,
              postalCode: customer.postalCode
                ? {set: customer.postalCode}
                : undefined,
              spouseName: customer.spouseName
                ? {set: customer.spouseName}
                : undefined,
              userId: {set: customer.userId},
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

      return NextResponse.json({
        message: 'Processamento concluído',
        successCount: results.length,
        errorCount: errors.length,
        errors,
      })
    },
    {
      context: 'POST /api/upload',
    },
  )
}
