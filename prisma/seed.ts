import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

export const EXPIRATION_DATE = '2024-12-21'

async function main() {
  await prisma.carnetSettings.create({
    data: {
      travelServiceName:
        'VIAGEM DE CASAIS / RENOVAÇÃO DE ALIANÇA 2025 | FORTALEZA / CANOA QUEBRADA - CE',
      installmentValue: 25555,
      installments: 9,
      defaultMessage:
        'Deus abençoe de forma poderosa o seu Casamento, estaremos juntos!',
      expirationDate: '2024-12-21',
    },
  })
}

main()
  .catch((error) => {
    console.error('Erro no seeding:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
