import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.ts";
import { api } from "../lib/api.ts";

const navStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  display: "block",
  padding: "9px 14px",
  borderRadius: 6,
  background: isActive ? "#3b5bdb" : "transparent",
  color: isActive ? "#fff" : "#555",
  fontWeight: 500,
  fontSize: 14,
});

const SECTION_LABEL: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#bbb", padding: "12px 14px 4px", display: "block" };

export default function Layout() {
  const role = useAuthStore((s) => s.role);
  const clear = useAuthStore((s) => s.clear);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const navigate = useNavigate();

  async function logout() {
    try { await api.post("/auth/logout", { refreshToken }); } catch { /* ignore */ }
    clear();
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, background: "#fff", borderRight: "1px solid #eee", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 20, padding: "0 4px", color: "#3b5bdb" }}>MotiPaper</div>

        <span style={SECTION_LABEL}>Operations</span>
        <NavLink to="/" end style={navStyle}>Dashboard</NavLink>
        <NavLink to="/jobs" style={navStyle}>Job Cards</NavLink>
        <NavLink to="/clients" style={navStyle}>Clients</NavLink>

        <span style={SECTION_LABEL}>Finance</span>
        <NavLink to="/billing" style={navStyle}>Billing & Khata</NavLink>
        <NavLink to="/reports" style={navStyle}>Reports</NavLink>

        <span style={SECTION_LABEL}>Stock</span>
        <NavLink to="/inventory" style={navStyle}>Inventory</NavLink>

        {(role === "owner" || role === "super_admin") && (
          <>
            <span style={SECTION_LABEL}>Settings</span>
            <NavLink to="/machines" style={navStyle}>Machines</NavLink>
            <NavLink to="/sub-admins" style={navStyle}>Sub Admins</NavLink>
          </>
        )}

        {role === "super_admin" && (
          <>
            <span style={SECTION_LABEL}>Platform</span>
            <NavLink to="/tenants" style={navStyle}>All Tenants</NavLink>
          </>
        )}

        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ padding: "9px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left", color: "#999", fontSize: 14 }}>
          Sign out
        </button>
      </aside>
      <main style={{ flex: 1, padding: 32, overflowY: "auto", background: "#f5f5f5" }}>
        <Outlet />
      </main>
    </div>
  );
}
