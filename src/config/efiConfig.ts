const efiConfig = {
  sandbox: process.env.EFI_SANDBOX === "true",
  client_id: process.env.EFI_CLIENT_ID ?? "",
  client_secret: process.env.EFI_CLIENT_SECRET ?? "",
  recebedor: {
    // IMPORTANTE: Para PIX Automático, estes dados DEVEM corresponder à conta das credenciais API.
    // Agencia: Geralmente '0001' para Efí Bank.
    agencia: process.env.EFI_RECEBEDOR_AGENCIA ?? "0001",
    // Conta: Número da conta com dígito, sem hífen (ex: se for 12345-6, use 123456).
    conta: (process.env.EFI_RECEBEDOR_CONTA ?? "275362").replace(/\D/g, ""),
    tipoConta: process.env.EFI_RECEBEDOR_TIPO_CONTA ?? "PAGAMENTO",
    ispb: process.env.EFI_RECEBEDOR_ISPB ?? "18236120",
    // CPF/CNPJ do titular da conta Efí.
    cpfCnpj: (
      process.env.EFI_RECEBEDOR_CPF_CNPJ ||
      process.env.EFI_PIX_KEY ||
      ""
    ).replace(/\D/g, ""),
  },
};

export default efiConfig;
