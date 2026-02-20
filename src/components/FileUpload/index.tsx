import React from "react";

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  loading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, loading }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".xlsx"
        onChange={handleFileChange}
        disabled={loading}
        className="mb-4"
      />
      <button
        onClick={() => {
          const input = document.querySelector(
            'input[type="file"]',
          ) as HTMLInputElement;
          input?.click();
        }}
        className={`rounded bg-blue-600 px-4 py-2 text-white ${
          loading ? "cursor-not-allowed opacity-50" : ""
        }`}
        disabled={loading}
      >
        {loading ? "Carregando..." : "Selecionar Arquivo"}
      </button>
    </div>
  );
};

export default FileUpload;
