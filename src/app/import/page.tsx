'use client'

import React, {useState} from 'react'

import FileUpload from '@/components/FileUpload'
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
          return await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })
        },
        {context: 'ImportPage'},
      )
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
