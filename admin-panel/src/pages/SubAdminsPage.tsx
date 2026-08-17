import { statusLabel } from "../theme.ts";
import "../components/TableSkeleton.tsx";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";

type Permission = "jobs.view"|"jobs.create"|"jobs.edit"|"jobs.delete"|"quotation.view"|"quotation.create"|"quotation.edit_rates"|"production.view"|"production.update_status"|"inventory.view"|"inventory.edit"|"inventory.create_po"|"billing.view"|"billing.create_invoice"|"billing.record_payment"|"clients.view"|"clients.edit"|"staff.view"|"staff.manage"|"reports.view_financial"|"settings.edit";

const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  { label: "Jobs", perms: ["jobs.view","jobs.create","jobs.edit","jobs.delete"] },
  { label: "Quotation", perms: ["quotation.view","quotation.create","quotation.edit_rates"] },
  { label: "Production", perms: ["production.view","production.update_status"] },
  { label: "Inventory", perms: ["inventory.view","inventory.edit","inventory.create_po"] },
  { label: "Billing", perms: ["billing.view","billing.create_invoice","billing.record_payment"] },
  { label: "Clients", perms: ["clients.view","clients.edit"] },
  { label: "Staff", perms: ["staff.view","staff.manage"] },
  { label: "Reports", perms: ["reports.view_financial"] },
  { label: "Settings", perms: ["settings.edit"] },
];
const PERM_LABEL: Record<Permission, string> = {
  "jobs.view":"View","jobs.create":"Create","jobs.edit":"Edit","jobs.delete":"Delete",
  "quotation.view":"View","quotation.create":"Create","quotation.edit_rates":"Edit Rates",
  "production.view":"View","production.update_status":"Update Status",
  "inventory.view":"View","inventory.edit":"Edit","inventory.create_po":"Create PO",
  "billing.view":"View","billing.create_invoice":"Create Invoice","billing.record_payment":"Record Payment",
  "clients.view":"View","clients.edit":"Edit","staff.view":"View","staff.manage":"Manage",
  "reports.view_financial":"View Financial","settings.edit":"Edit Settings",
};

interface User { id: string; name: string; email: string; role: string; status: string; }

function PermissionMatrix({ userId }: { userId: string }) {
  const { data: existingPerms = [], isLoading } = useQuery<Permission[]>({
    queryKey: ["user-perms", userId],
    queryFn: () => api.get(`/admin/users/${userId}/permissions`).then(r => r.data),
  });
  const [selected, setSelected] = useState<Set<Permission>>(new Set<Permission>());

  useEffect(() => { if (existingPerms.length) setSelected(new Set(existingPerms)); }, [existingPerms.join(",")]);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (perms: Permission[]) => api.patch(`/admin/users/${userId}/permissions`, { permissions: perms }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sub-admins"] }),
  });
  const toggle = (p: Permission) => setSelected(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  if (isLoading) return <div style={{ padding: 16, color: "#888", fontSize: 13 }}>Loading permissions…</div>;

  return (
    <div style={{ marginTop: 14 }}>
      {PERMISSION_GROUPS.map(g => (
        <div key={g.label} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>{g.label}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {g.perms.map(p => (
              <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13, padding: "3px 10px", borderRadius: 6, background: selected.has(p) ? "#eef2ff" : "#f5f5f5", border: `1px solid ${selected.has(p) ? "#3b5bdb" : "#ddd"}`, color: selected.has(p) ? "#3b5bdb" : "#555" }}>
                <input type="checkbox" checked={selected.has(p)} onChange={() => toggle(p)} style={{ accentColor: "#3b5bdb" }} />
                {PERM_LABEL[p]}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => save.mutate([...selected])} disabled={save.isPending} style={{ marginTop: 8, padding: "7px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
        {save.isPending ? "Saving…" : "Save Permissions"}
      </button>
    </div>
  );
}

export default function SubAdminsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [createError, setCreateError] = useState("");
  const qc = useQueryClient();
  const [list, actions] = useListState({ sortBy: "created_at", filters: {} });

  const { data, isLoading } = useQuery<PagedResult<User>>({
    queryKey: ["sub-admins", actions.toParams()],
    queryFn: () => api.get("/admin/users", { params: { ...actions.toParams(), role: "sub_admin" } }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const inputStyle: React.CSSProperties = { flex: 1, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, width: "100%" };

  const create = useMutation({
    mutationFn: () => api.post("/admin/users", { name: form.name, email: form.email, password: form.password, staffType: undefined, status: "active", role: "sub_admin" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sub-admins"] }); setShowCreate(false); setForm({ name: "", email: "", password: "" }); setCreateError(""); },
    onError: (e: unknown) => setCreateError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to create sub admin."),
  });

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Sub Admins</h1>
      {showCreate && (
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
          <h3 style={{ marginBottom: 16 }}>Create Sub Admin</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            <label style={{ fontSize: 13 }}>Name *<input placeholder="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></label>
            <label style={{ fontSize: 13 }}>Email *<input placeholder="email@example.com" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></label>
            <label style={{ fontSize: 13 }}>Password *<input placeholder="Min 6 characters" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} /></label>
          </div>
          {createError && <div style={{ color: "#c92a2a", fontSize: 13, marginBottom: 10 }}>{createError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.email || form.password.length < 6} style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>{create.isPending ? "Creating…" : "Create Sub Admin"}</button>
            <button onClick={() => { setShowCreate(false); setCreateError(""); }} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
          </div>
        </div>
      )}
      <TableControls search={list.search} onSearch={actions.setSearch} placeholder="Search name, email…"
        activeFilters={list.filters} onFilter={actions.setFilter} onReset={actions.resetFilters}
        filters={[{ key: "status", label: "Status", options: [{ label: "Active", value: "active" }, { label: "Invited", value: "invited" }, { label: "Inactive", value: "inactive" }] }]}
        rightSlot={<button onClick={() => setShowCreate(true)} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ New Sub Admin</button>}
      />
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="shimmer-cell" style={{ width: 160, height: 14 }} />
                <div className="shimmer-cell" style={{ width: 220, height: 12 }} />
              </div>
              <div className="shimmer-cell" style={{ width: 56, height: 22, borderRadius: 10 }} />
            </div>
          ))}
        </div>
      )}
      {!isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data?.data?.map((u) => (
            <div key={u.id} style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
              <div onClick={() => setExpanded(expanded === u.id ? null : u.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", cursor: "pointer" }}>
                <div><div style={{ fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 13, color: "#888" }}>{u.email}</div></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: u.status === "active" ? "#d3f9d8" : "#fff3bf", color: u.status === "active" ? "#2b8a3e" : "#e67700" }}>{statusLabel(u.status)}</span>
                  <span style={{ color: "#aaa" }}>{expanded === u.id ? "▲" : "▼"}</span>
                </div>
              </div>
              {expanded === u.id && <div style={{ padding: "0 18px 18px" }}><PermissionMatrix userId={u.id} /></div>}
            </div>
          ))}
          {!data?.data?.length && <p style={{ color: "#888" }}>No sub-admins yet.</p>}
        </div>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
