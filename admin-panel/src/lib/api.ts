import axios from "axios";
import { useAuthStore } from "../store/auth.ts";

export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setTokens, clear, role, tenantId, userId } = useAuthStore.getState();
      if (!refreshToken) { clear(); return Promise.reject(error); }
      try {
        const { data } = await axios.post("/api/v1/auth/refresh", { refreshToken });
        setTokens(data.accessToken, data.refreshToken, role!, tenantId, userId!);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        clear();
      }
    }
    return Promise.reject(error);
  },
);
