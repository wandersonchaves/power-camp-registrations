declare module "sdk-node-apis-efi" {
  interface EfiPayConfig {
    sandbox: boolean;
    client_id: string;
    client_secret: string;
    certificate: string;
  }

  interface EfiPayResponse {
    code: number;
    data: EfiPayData;
  }
}
