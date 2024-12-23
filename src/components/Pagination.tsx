import React from 'react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const isCurrentPage = (page: number) => currentPage === page

  return (
    <nav>
      <ul className="mt-4 flex justify-center -space-x-px text-sm">
        {/* Botão para página anterior */}
        <button
          className="ms-0 flex h-10 items-center justify-center rounded-s-lg border border-e-0 border-gray-300 bg-white px-4 leading-tight text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Anterior
        </button>

        {/* Botões de página */}
        {[...Array(totalPages)].map((_, index) => {
          const page = index + 1
          return (
            <button
              key={page}
              className={`flex h-10 items-center justify-center border border-gray-300 px-4 leading-tight text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white ${
                isCurrentPage(page)
                  ? 'bg-blue-800 text-white dark:bg-blue-600 dark:text-white'
                  : 'bg-white dark:bg-gray-800'
              }`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        })}

        {/* Botão para próxima página */}
        <button
          className="flex h-10 items-center justify-center rounded-e-lg border border-gray-300 bg-white px-4 leading-tight text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Próximo
        </button>
      </ul>
    </nav>
  )
}

export default Pagination
