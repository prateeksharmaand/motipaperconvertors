import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";

interface Tenant { id: string; name: string; slug: string; plan: string; status: string; created_at: string; }

const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14 };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

function NewTenantForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", slug: "", email: "", phone: "", city: "", plan: "free", ownerName: "", ownerEmail: "", ownerPassword: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => api.post("/platform/tenants", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenants"] }); onClose(); },
  });
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>New Tenant / Press</h3>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Press Details</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label><span style={{ fontSize: 13 }}>Press Name *</span><input style={inputStyle} value={form.name} onChange={set("name")} /></label>
        <label><span style={{ fontSize: 13 }}>Slug *</span><input style={inputStyle} placeholder="unique-id" value={form.slug} onChange={set("slug")} /></label>
        <label><span style={{ fontSize: 13 }}>Email</span><input style={inputStyle} type="email" value={form.email} onChange={set("email")} /></label>
        <label><span style={{ fontSize: 13 }}>Phone</span><input style={inputStyle} value={form.phone} onChange={set("phone")} /></label>
        <label><span style={{ fontSize: 13 }}>City</span><input style={inputStyle} value={form.city} onChange={set("city")} /></label>
        <label><span style={{ fontSize: 13 }}>Plan</span>
          <select style={inputStyle} value={form.plan} onChange={set("plan")}>
            <option value="free">Free</option><option value="starter">Starter</option><option value="pro">Pro</option>
          </select>
        </label>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Owner Account</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label><span style={{ fontSize: 13 }}>Owner Name *</span><input style={inputStyle} value={form.ownerName} onChange={set("ownerName")} /></label>
        <label><span style={{ fontSize: 13 }}>Owner Email *</span><input style={inputStyle} type="email" value={form.ownerEmail} onChange={set("ownerEmail")} /></label>
        <label><span style={{ fontSize: 13 }}>Password *</span><input style={inputStyle} type="password" value={form.ownerPassword} onChange={set("ownerPassword")} /></label>
      </div>
      {save.isError && <div style={{ color: "#c92a2a", fontSize: 13, marginBottom: 8 }}>Failed to create tenant. Check all fields.</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => save.mutate()} disabled={!form.name || !form.slug || !form.ownerName || !form.ownerEmail || !form.ownerPassword || save.isPending}
          style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          {save.isPending ? "Creating…" : "Create Tenant"}
        </button>
        <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();
  const [list, actions] = useListState({ sortBy: "created_at" });

  const { data, isLoading } = useQuery<PagedResult<Tenant>>({
    queryKey: ["tenants", actions.toParams()],
    queryFn: () => api.get("/platform/tenants", { params: actions.toParams() }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/platform/tenants/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants"] }),
  });

  const col = (label: string, key: string) => (
    <th style={th} onClick={() => actions.setSort(key)}>{label}<SortIcon col={key} sortBy={list.sortBy} sortDir={list.sortDir} /></th>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>All Tenants</h1>
      {showForm && <NewTenantForm onClose={() => setShowForm(false)} />}
      <TableControls search={list.search} onSearch={actions.setSearch} placeholder="Search press name, slug…"
        activeFilters={list.filters} onFilter={actions.setFilter} onReset={actions.resetFilters}
        filters={[
          { key: "status", label: "Status", options: [{ label: "Active", value: "active" }, { label: "Suspended", value: "suspended" }] },
          { key: "plan", label: "Plan", options: [{ label: "Free", value: "free" }, { label: "Starter", value: "starter" }, { label: "Pro", value: "pro" }] },
        ]}
        rightSlot={<button onClick={() => setShowForm(true)} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ New Tenant</button>} />
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {col("Press Name", "name")} {col("Slug", "slug")} {col("Plan", "plan")} {col("Status", "status")} {col("Joined", "created_at")} <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#888" }}>Loading…</td></tr>}
            {data?.data?.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ ...td, fontWeight: 500 }}>{t.name}</td>
                <td style={{ ...td, color: "#888" }}>{t.slug}</td>
                <td style={td}>{t.plan}</td>
                <td style={td}><span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: t.status === "active" ? "#d3f9d8" : "#ffe3e3", color: t.status === "active" ? "#2b8a3e" : "#c92a2a" }}>{t.status}</span></td>
                <td style={td}>{new Date(t.created_at).toLocaleDateString("en-IN")}</td>
                <td style={td}><button onClick={() => toggleStatus.mutate({ id: t.id, status: t.status === "active" ? "suspended" : "active" })} style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff" }}>{t.status === "active" ? "Suspend" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 0 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
