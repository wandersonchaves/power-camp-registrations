// src/components/UI/Modal.tsx
import {FC, ReactNode} from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

const Modal: FC<ModalProps> = ({isOpen, onClose, children}) => {
  if (!isOpen) return null

  return (
    <div className="bg-opacity/50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
        <div className="p-4">
          <button
            className="absolute right-2 top-2 text-gray-600 hover:text-black"
            onClick={onClose}
          >
            ✕
          </button>
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
