import { create } from "zustand";
import { persist } from "zustand/middleware";

type Role = "super_admin" | "owner" | "sub_admin" | "staff" | "operator";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: Role | null;
  tenantId: string | null;
  userId: string | null;
  permissions: string[];
  setTokens: (at: string, rt: string, role: Role, tenantId: string | null, userId: string) => void;
  setPermissions: (permissions: string[]) => void;
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
      permissions: [],
      setTokens: (accessToken, refreshToken, role, tenantId, userId) =>
        set({ accessToken, refreshToken, role, tenantId, userId }),
      setPermissions: (permissions) => set({ permissions }),
      clear: () => set({ accessToken: null, refreshToken: null, role: null, tenantId: null, userId: null, permissions: [] }),
    }),
    { name: "motipaper-auth" },
  ),
);

// Owners and super_admins have all permissions implicitly
export function useHasPerm(permission: string): boolean {
  const role = useAuthStore(s => s.role);
  const permissions = useAuthStore(s => s.permissions);
  if (role === "owner" || role === "super_admin") return true;
  return permissions.includes(permission);
}
