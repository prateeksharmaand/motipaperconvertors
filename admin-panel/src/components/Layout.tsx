import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuthStore, useHasPerm } from "../store/auth.ts";
import { api } from "../lib/api.ts";
import PaperRateModal, { shouldShowPaperRateToday } from "./PaperRateModal.tsx";

const SIDEBAR_W = 220;

const sectionLabel: React.CSSProperties = {
  padding: "20px 16px 6px",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  color: "#6b7280",
  display: "block",
};

function navStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 16px",
    margin: "1px 8px",
    borderRadius: 8,
    background: isActive ? "#7c3aed" : "transparent",
    color: isActive ? "#fff" : "#9ca3af",
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 0.15s, color 0.15s",
  };
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  sub_admin: "Sub Admin",
  staff: "Staff",
  operator: "Operator",
};

export default function Layout() {
  const role = useAuthStore((s) => s.role);
  const userId = useAuthStore((s) => s.userId);
  const clear = useAuthStore((s) => s.clear);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const navigate = useNavigate();
  const setPermissions = useAuthStore(s => s.setPermissions);
  const canViewJobs = useHasPerm("jobs.view");
  const canViewClients = useHasPerm("clients.view");
  const canViewInventory = useHasPerm("inventory.view");
  const canViewBilling = useHasPerm("billing.view");
  const canViewReports = useHasPerm("reports.view_financial");
  const canViewActivityLog = useHasPerm("activity_log.view");
  const canViewStaff = useHasPerm("staff.view");
  const canViewQuotations = useHasPerm("quotation.view");
  const [showPaperRate, setShowPaperRate] = useState(false);

  // Fetch current user's permissions on mount
  useEffect(() => {
    api.get("/auth/me").then(r => setPermissions(r.data.permissions ?? [])).catch(() => {});
  }, []);

  // Show paper rate modal once per day on first load for owner/sub_admin
  useEffect(() => {
    if ((role === "owner" || role === "sub_admin") && shouldShowPaperRateToday()) {
      setShowPaperRate(true);
    }
  }, [role]);

  async function logout() {
    try { await api.post("/auth/logout", { refreshToken }); } catch { /* ignore */ }
    clear();
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {showPaperRate && <PaperRateModal onClose={() => setShowPaperRate(false)} />}
      {/* ── Sidebar ── */}
      <aside style={{
        width: SIDEBAR_W,
        background: "#1f2937",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        overflowY: "auto",
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          borderBottom: "1px solid #374151",
          flexShrink: 0,
        }}>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 700, letterSpacing: "-0.3px" }}>
            MotiPaper
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingBottom: 12 }}>
          <span style={sectionLabel}>Operations</span>
          <NavLink to="/" end style={navStyle}>Dashboard</NavLink>
          {canViewJobs && <NavLink to="/jobs" style={navStyle}>Job Cards</NavLink>}
          {canViewJobs && <NavLink to="/proofs" style={navStyle}>Proofs</NavLink>}
          {canViewQuotations && <NavLink to="/quotations" style={navStyle}>Quotations</NavLink>}
          {canViewClients && <NavLink to="/clients" style={navStyle}>Clients</NavLink>}
          {canViewStaff && <NavLink to="/staff" style={navStyle}>Staff</NavLink>}

          <span style={sectionLabel}>Finance</span>
          {canViewInventory && <NavLink to="/inventory" style={navStyle}>Inventory</NavLink>}
          {canViewBilling && <NavLink to="/billing" style={navStyle}>Billing</NavLink>}
          {canViewReports && <NavLink to="/reports" style={navStyle}>Reports</NavLink>}
          {canViewActivityLog && <NavLink to="/activity-logs" style={navStyle}>Activity Log</NavLink>}

          {(role === "owner" || role === "super_admin") && (
            <>
              <span style={sectionLabel}>Config</span>
              <NavLink to="/machines" style={navStyle}>Machines</NavLink>
              <NavLink to="/sub-admins" style={navStyle}>Sub Admins</NavLink>
              <NavLink to="/settings" style={navStyle}>Settings</NavLink>
            </>
          )}

          {role === "super_admin" && (
            <>
              <span style={sectionLabel}>Platform</span>
              <NavLink to="/tenants" style={navStyle}>Tenants</NavLink>
            </>
          )}
        </nav>

        {/* User info + logout */}
        <div style={{
          borderTop: "1px solid #374151",
          padding: "12px 16px",
          flexShrink: 0,
        }}>
          <div style={{ color: "#9ca3af", fontSize: 11, marginBottom: 2 }}>
            {role ? (ROLE_LABEL[role] ?? role) : "—"}
          </div>
          {userId && (
            <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              ID: {userId.slice(0, 8)}…
            </div>
          )}
          <button
            onClick={logout}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ef4444",
              fontSize: 12,
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ marginLeft: SIDEBAR_W, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top bar */}
        <header style={{
          height: 56,
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          flexShrink: 0,
        }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#111827" }}>MotiPaper Admin</span>
          <div style={{
            background: "#ede9fe",
            color: "#6d28d9",
            borderRadius: 10,
            padding: "2px 10px",
            fontSize: 11,
            fontWeight: 600,
          }}>
            {role ? (ROLE_LABEL[role] ?? role) : "—"}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: 24, background: "var(--color-bg)", overflowY: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
