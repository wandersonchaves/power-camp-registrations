const efiConfig = {
  sandbox: process.env.EFI_SANDBOX === "true",
  client_id: process.env.EFI_CLIENT_ID ?? "",
  client_secret: process.env.EFI_CLIENT_SECRET ?? "",
  recebedor: {
    // Para contas digitais Efí, a agência costuma ser 0001
    agencia: process.env.EFI_RECEBEDOR_AGENCIA ?? "0001",
    // O número da conta costuma ser o identificador que aparece no nome do certificado (ex: 275362)
    conta: process.env.EFI_RECEBEDOR_CONTA ?? "275362",
    tipoConta: process.env.EFI_RECEBEDOR_TIPO_CONTA ?? "PAGAMENTO",
    ispb: process.env.EFI_RECEBEDOR_ISPB ?? "18236120",
    // O CPF/CNPJ do titular da conta Efí (necessário para o campo 'destinatario' em solicitações)
    cpfCnpj: (
      process.env.EFI_RECEBEDOR_CPF_CNPJ ||
      process.env.EFI_PIX_KEY ||
      ""
    ).replace(/\D/g, ""),
  },
};

export default efiConfig;
