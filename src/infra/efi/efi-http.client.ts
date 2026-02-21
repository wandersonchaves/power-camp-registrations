import axios, { type AxiosInstance } from "axios";

export function getEfiHttpClient(): AxiosInstance {
  return axios.create({
    baseURL: process.env.EFI_BASE_URL,
    // ...
  });
}
