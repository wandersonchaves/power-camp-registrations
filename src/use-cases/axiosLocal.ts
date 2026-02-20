import axios from "axios";

const axiosLocal = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default axiosLocal;
