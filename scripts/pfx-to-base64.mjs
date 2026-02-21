#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(`
Uso:
  node scripts/pfx-to-base64.mjs /caminho/para/certificado.p12

Saída:
  - EFI_PFX_BASE64 (base64 puro, em 1 linha)
  - EFI_PFX_DATA_URL (data:application/x-pkcs12;base64,...)

Dica:
  Para Railway, você pode colar o base64 puro (preferível).
`);
}

const file = process.argv[2];
if (!file) {
  usage();
  process.exit(1);
}

const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error(`Arquivo não encontrado: ${abs}`);
  process.exit(1);
}

const buf = fs.readFileSync(abs);
const b64 = buf.toString("base64");

// ✅ Base64 puro (recomendado)
console.log("\nEFI_PFX_BASE64 (base64 puro):\n");
console.log(b64);

// ✅ Data URL (opcional)
console.log("\n\nEFI_PFX_DATA_URL (opcional):\n");
console.log(`data:application/x-pkcs12;base64,${b64}`);

// ✅ “preview” curto
console.log("\n\nPreview:");
console.log(`${b64.slice(0, 32)}...${b64.slice(-32)}`);
