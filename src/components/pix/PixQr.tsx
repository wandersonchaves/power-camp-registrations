"use client";

import * as React from "react";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
  value: string;
  title?: string;
};

export function PixQr({ value, title }: Props) {
  return (
    <div className="flex flex-col items-center">
      {title && (
        <div className="text-muted-foreground mb-4 text-sm font-bold uppercase tracking-widest">
          {title}
        </div>
      )}

      <div className="border-muted rounded-3xl border-4 bg-white p-4 shadow-inner">
        <QRCodeCanvas
          value={value}
          size={240}
          level="H"
          includeMargin={false}
          className="rounded-xl"
        />
      </div>

      <p className="text-muted-foreground mt-4 max-w-[200px] text-center text-xs font-medium leading-relaxed">
        Escaneie o código acima com o aplicativo do seu banco para pagar.
      </p>
    </div>
  );
}
