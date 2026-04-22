const efiConfig = {
  sandbox: process.env.EFI_SANDBOX === "true",
  client_id: process.env.EFI_CLIENT_ID ?? "",
  client_secret: process.env.EFI_CLIENT_SECRET ?? "",
  recebedor: {
    agencia: process.env.EFI_RECEBEDOR_AGENCIA ?? "1823",
    conta: process.env.EFI_RECEBEDOR_CONTA ?? "54940917",
    tipoConta: process.env.EFI_RECEBEDOR_TIPO_CONTA ?? "PAGAMENTO",
    ispb: process.env.EFI_RECEBEDOR_ISPB ?? "18236120",
  },
};

export default efiConfig;
