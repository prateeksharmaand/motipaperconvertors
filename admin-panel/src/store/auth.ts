import { create } from "zustand";
import { persist } from "zustand/middleware";

type Role = "super_admin" | "owner" | "sub_admin" | "staff" | "operator";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: Role | null;
  tenantId: string | null;
  userId: string | null;
  setTokens: (at: string, rt: string, role: Role, tenantId: string | null, userId: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      tenantId: null,
      userId: null,
      setTokens: (accessToken, refreshToken, role, tenantId, userId) =>
        set({ accessToken, refreshToken, role, tenantId, userId }),
      clear: () => set({ accessToken: null, refreshToken: null, role: null, tenantId: null, userId: null }),
    }),
    { name: "motipaper-auth" },
  ),
);
