import axios from "axios";
import { useAuthStore } from "../store/auth.ts";

export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single in-flight refresh promise — all concurrent 401s wait on the same one
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setTokens, clear, role, tenantId, userId } = useAuthStore.getState();
      if (!refreshToken) { clear(); return Promise.reject(error); }

      try {
        // If a refresh is already in flight, wait for it rather than firing a second one
        if (!refreshPromise) {
          refreshPromise = axios
            .post("/api/v1/auth/refresh", { refreshToken })
            .then(({ data }) => {
              setTokens(data.accessToken, data.refreshToken, role!, tenantId, userId!);
              return data.accessToken;
            })
            .finally(() => { refreshPromise = null; });
        }

        const newAccessToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch {
        clear();
      }
    }
    return Promise.reject(error);
  },
);
