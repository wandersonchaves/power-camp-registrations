import React, { useState } from "react";

interface EditParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expireAt: string) => void;
  currentExpireAt: string;
}

export default function EditParcelModal({
  isOpen,
  onClose,
  onSave,
  currentExpireAt,
}: EditParcelModalProps) {
  const [expireAt, setExpireAt] = useState(currentExpireAt);

  if (!isOpen) return null;

  return (
    <div className="bg-opacity/50 fixed inset-0 flex items-center justify-center bg-gray-600">
      <div className="w-1/3 rounded bg-white p-6 shadow-md">
        <h2 className="text-lg font-bold">Editar Data de Vencimento</h2>
        <input
          type="date"
          className="mt-4 w-full rounded border border-gray-300 p-2"
          value={expireAt}
          onChange={(e) => setExpireAt(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded bg-gray-300 px-4 py-2" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="rounded bg-blue-500 px-4 py-2 text-white"
            onClick={() => onSave(expireAt)}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
