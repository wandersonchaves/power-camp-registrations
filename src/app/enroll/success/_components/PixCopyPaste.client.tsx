"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface PixCopyPasteProps {
  value: string;
  label?: string;
}

export function PixCopyPaste({
  value,
  label = "Copia e Cola",
}: PixCopyPasteProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const handleSelect = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    (e.target as HTMLTextAreaElement).select();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-black uppercase transition-colors active:scale-95"
        >
          {copied ? (
            <>
              <Check className="size-3" /> Copiado!
            </>
          ) : (
            <>
              <Copy className="size-3" /> Copiar Código
            </>
          )}
        </button>
      </div>

      <div className="group relative">
        <textarea
          readOnly
          className="focus:ring-primary/20 h-24 w-full cursor-pointer rounded-xl border bg-white p-3 font-mono text-xs outline-none transition-all focus:ring-2"
          value={value}
          onClick={handleSelect}
        />
        <div className="group-hover:ring-primary/10 pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-transparent transition-all" />
      </div>
    </div>
  );
}
