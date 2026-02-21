"use client";

import React from "react";
import QRCode from "qrcode";

export function PixQrCode({ payload }: { payload: string }) {
  const [dataUrl, setDataUrl] = React.useState<string>("");

  React.useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(payload, { margin: 1, width: 260 })
      .then((url) => mounted && setDataUrl(url))
      .catch(() => mounted && setDataUrl(""));
    return () => {
      mounted = false;
    };
  }, [payload]);

  if (!dataUrl) return <p>Gerando QR…</p>;

  return <img src={dataUrl} alt="QR Code Pix" />;
}
