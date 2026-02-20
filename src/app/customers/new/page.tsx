'use client'

import {useState} from 'react'
import {CustomerStatusEnum} from '@prisma/client'
import axios from 'axios'
import {useRouter} from 'next/navigation'

import axiosLocal from '@/use-cases/axiosLocal'

const getStatusLabel = (status: CustomerStatusEnum): string => {
  switch (status) {
    case CustomerStatusEnum.WAITING_LIST:
      return 'Lista de Espera'
    case CustomerStatusEnum.CONFIRMED:
      return 'Confirmado'
    case CustomerStatusEnum.CANCELED:
      return 'Cancelado'
    case CustomerStatusEnum.INACTIVE:
      return 'Inativo'
    case CustomerStatusEnum.ACTIVE:
      return 'Ativo'
    default:
      return 'Desconhecido'
  }
}

const NewCustomer = () => {
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    birthDate: '',
    phone: '',
    email: '',
    address: '',
    postalCode: '',
    spouseName: '',
    status: 'WAITING_LIST',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const statusOptions = Object.values(CustomerStatusEnum)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const {name, value} = e.target
    setFormData((prev) => ({...prev, [name]: value}))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Fazendo a requisição utilizando a instância do Axios
      const response = await axiosLocal.post('/customers', formData)

      // Redireciona para a página de clientes após o sucesso
      if (response.status === 201) {
        router.push('/customers')
      } else {
        throw new Error(
          response.data?.message || 'Erro desconhecido ao criar cliente.',
        )
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        // Tratamento específico para erros do Axios
        setError(
          err.response?.data?.message || 'Erro ao processar a requisição.',
        )
        console.error('Erro do Axios:', err.response?.data || err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erro desconhecido.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-4 text-2xl font-bold">CADASTRAR NOVO INSCRITO</h1>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              Nome
            </label>
            <input
              type="text"
              name="name"
              placeholder="Ex.: João da Silva"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="cpf"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              CPF
            </label>
            <input
              type="text"
              name="cpf"
              placeholder="Ex.: 123.456.789-00"
              value={formData.cpf}
              onChange={handleInputChange}
              required
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label
              htmlFor="birthDate"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              Data de Nascimento
            </label>
            <input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleInputChange}
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              Telefone
            </label>
            <input
              type="text"
              name="phone"
              placeholder="Ex.: (86) 99999-9999"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="Ex.: joao.silva@email.com"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label
              htmlFor="address"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              Endereço
            </label>
            <input
              type="text"
              name="address"
              placeholder="Ex.: Rua das Flores, 123"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label
              htmlFor="cep"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              CEP
            </label>
            <input
              type="text"
              name="postalCode"
              placeholder="Ex.: 64000-000"
              value={formData.postalCode}
              onChange={handleInputChange}
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label
              htmlFor="spouseName"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              Nome do Cônjuge (opcional)
            </label>
            <input
              type="text"
              name="spouseName"
              placeholder="Ex.: Maria da Silva"
              value={formData.spouseName}
              onChange={handleInputChange}
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full rounded border px-3 py-2"
            >
              {statusOptions.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div>{error && <p className="text-red-500">{error}</p>}</div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          {loading ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>
    </div>
  )
}

export default NewCustomer
