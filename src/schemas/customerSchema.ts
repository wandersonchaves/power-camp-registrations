import {z} from 'zod'

export const customerSchema = z.object({
  name: z.string().min(1, {message: 'O nome é obrigatório.'}),
  cpf: z
    .string()
    .transform((cpf) => cpf.replace(/\D/g, ''))
    .refine((cpf) => /^\d{11}$/.test(cpf), {message: 'CPF inválido.'}),
  birthDate: z
    .string()
    .transform((date) => new Date(date))
    .refine((date) => !isNaN(date.getTime()), {message: 'Data inválida.'}),
  phone: z.string().min(10).max(11).optional(),
  email: z.string().email({message: 'Email inválido.'}).optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  spouseName: z.string().optional(),
  status: z.enum([
    'WAITING_LIST',
    'CONFIRMED',
    'CANCELED',
    'INACTIVE',
    'ACTIVE',
  ]),
})

export type CustomerInput = z.infer<typeof customerSchema>
