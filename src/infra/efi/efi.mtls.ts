// src/infra/efi/efi.mtls.ts
import fs from "node:fs";
import https from "node:https";

import { getEfiConfig } from "./efi.config";

let agentSingleton: https.Agent | null = null;

export function getEfiHttpsAgent(): https.Agent {
  if (agentSingleton) return agentSingleton;

  const cfg = getEfiConfig();

  /**
   * ✅ Prioridade 1 → PFX (.p12 / .pfx)
   */
  if (cfg.p12) {
    agentSingleton = new https.Agent({
      pfx: cfg.p12,
      passphrase: cfg.passphrase, // pode ser "" ou undefined
      keepAlive: true,
    });

    return agentSingleton;
  }

  /**
   * ✅ Prioridade 2 → PEM (cert + key)
   */
  if (cfg.certPemPath && cfg.certKeyPemPath) {
    const cert = fs.readFileSync(cfg.certPemPath);
    const key = fs.readFileSync(cfg.certKeyPemPath);

    agentSingleton = new https.Agent({
      cert,
      key,
      passphrase: cfg.certPassphrase, // opcional
      keepAlive: true,
    });

    return agentSingleton;
  }

  /**
   * ❌ Nenhum certificado configurado
   */
  throw new Error(
    [
      "EFI mTLS cert missing.",
      "Provide one of:",
      "- EFI_PFX_BASE64 + EFI_PASSPHRASE",
      "- EFI_PFX_PATH + EFI_PASSPHRASE",
      "- EFI_CERT_PEM_PATH + EFI_CERT_KEY_PEM_PATH",
    ].join(" "),
  );
}
