'use client'

import React, {useState} from 'react'

import FileUpload from '@/components/FileUpload'
import axiosLocal from '@/use-cases/axiosLocal'
import {ErrorHandler} from '@/utils/errorHandler'

const ImportPage: React.FC = () => {
  const [loading, setLoading] = useState(false)

  const handleFileUpload = async (file: File) => {
    setLoading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      await ErrorHandler.handle(
        async () => {
          // Utilizando a instância do Axios para enviar o arquivo
          return await axiosLocal.post('/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          })
        },
        {context: 'ImportPage'},
      )
    } catch (error) {
      console.error('Erro no upload do arquivo:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mt-10 flex flex-col items-center gap-3 text-center md:absolute md:left-1/2 md:top-1/2 md:mt-0 md:-translate-x-1/2 md:-translate-y-1/2">
      <h1 className="mb-4 text-2xl font-bold">Importar Arquivo Excel</h1>
      <FileUpload
        onFileUpload={handleFileUpload}
        loading={loading}
      />
    </div>
  )
}

export default ImportPage
