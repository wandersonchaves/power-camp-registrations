import {FC, ReactNode} from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

const Modal: FC<ModalProps> = ({isOpen, onClose, children}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex h-[calc(100%-1rem)] max-h-full w-full items-center justify-center overflow-hidden overflow-y-auto md:inset-0">
      <div className="relative z-10 max-h-full w-full max-w-2xl p-4 sm:px-0">
        <div className="relative mx-auto max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow dark:bg-gray-700">
          <button
            className="absolute right-4 top-4 text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
            onClick={onClose}
            aria-label="Fechar Modal"
          >
            ✕
          </button>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default Modal
