"use client";

import * as React from "react";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
  value: string;
  title?: string;
};

export function PixQr({ value, title }: Props) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      {title ? <div className="text-sm font-semibold">{title}</div> : null}

      <div className="mt-3 flex flex-col items-center gap-3">
        <div className="rounded-2xl border bg-white p-3">
          <QRCodeCanvas value={value} size={220} />
        </div>

        <p className="text-center text-xs text-gray-600">
          Escaneie com o app do seu banco ou copie o código abaixo.
        </p>
      </div>

      <div className="mt-3">
        <textarea
          readOnly
          className="h-28 w-full rounded-2xl border bg-gray-50 p-3 font-mono text-xs outline-none"
          value={value}
        />
      </div>

      <button
        type="button"
        onClick={copy}
        className="mt-3 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
      >
        {copied ? "Copiado ✅" : "Copiar código Pix"}
      </button>
    </div>
  );
}
