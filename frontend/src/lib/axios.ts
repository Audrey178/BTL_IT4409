import axios from "axios";
import { useAuthStore } from "@/stores/useAuthStore";

const api = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "http://localhost:3000/api/v1"
      : "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // Add logic for refresh token here later if needed
    if (err.response?.status === 401 && !err.config._retry) {
      // For now, logout on 401
      useAuthStore.getState().clearState();
    }
    return Promise.reject(err);
  }
);

export default api;
