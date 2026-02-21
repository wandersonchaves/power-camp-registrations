declare module "sdk-node-apis-efi" {
  export interface EfiPayConfig {
    sandbox: boolean;
    client_id: string;
    client_secret: string;
    certificate: string;
  }

  export type EfiPayData = Record<string, unknown>;

  export interface EfiPayResponse {
    code: number;
    data: EfiPayData;
  }

  // Se você usa instância/classe no projeto, mantenha genérico:
  const EfiPay: new (config: EfiPayConfig) => {
    // métodos variam conforme SDK; tipa de forma permissiva e segura
    [key: string]: (...args: unknown[]) => Promise<EfiPayResponse>;
  };

  export default EfiPay;
}
