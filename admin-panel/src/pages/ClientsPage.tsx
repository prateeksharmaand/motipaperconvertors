import PrintListButton from "../components/PrintListButton.tsx";
import IconButton from "../components/IconButton.tsx";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";
import { exportToCsv } from "../lib/exportCsv.ts";

interface Client { id: string; name: string; company_name: string; phone: string; email: string; city: string; gstin: string; status: string; email_reminder: boolean; }

const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14 };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

function ClientForm({ initial, onSave, onCancel }: { initial?: Partial<Client>; onSave: (d: Record<string, string | boolean>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", company_name: "", phone: "", email: "", city: "", gstin: "", email_reminder: false, ...initial });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>{initial?.id ? "Edit Client" : "New Client"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <label><span style={{ fontSize: 13 }}>Name *</span><input style={inputStyle} value={form.name} onChange={set("name")} /></label>
        <label><span style={{ fontSize: 13 }}>Company</span><input style={inputStyle} value={form.company_name} onChange={set("company_name")} /></label>
        <label><span style={{ fontSize: 13 }}>Phone</span><input style={inputStyle} value={form.phone} onChange={set("phone")} /></label>
        <label><span style={{ fontSize: 13 }}>Email</span><input style={inputStyle} type="email" value={form.email} onChange={set("email")} /></label>
        <label><span style={{ fontSize: 13 }}>City</span><input style={inputStyle} value={form.city} onChange={set("city")} /></label>
        <label><span style={{ fontSize: 13 }}>GSTIN</span><input style={inputStyle} value={form.gstin} onChange={set("gstin")} /></label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={!!form.email_reminder} onChange={e => setForm(f => ({ ...f, email_reminder: e.target.checked }))}
          style={{ width: 16, height: 16, accentColor: "#7c3aed" }} />
        <span style={{ fontSize: 13, color: "#374151" }}>
          <strong>Auto Email Reminder</strong> — send daily payment reminder at 9 AM automatically
        </span>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave(form as Record<string, string | boolean>)} style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>Save</button>
        <button onClick={onCancel} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get("/admin/clients", { params: { limit: 5000 } });
      const clients: Client[] = res.data.data ?? [];
      const date = new Date().toISOString().slice(0, 10);
      const rows = clients.map(c => ({
        name: c.name, company_name: c.company_name, phone: c.phone,
        email: c.email, city: c.city, gstin: c.gstin, status: c.status,
      }));
      exportToCsv(`clients-${date}.csv`, rows);
    } finally {
      setExporting(false);
    }
  }
  const [list, actions] = useListState({ sortBy: "name", filters: {} });

  const { data, isLoading } = useQuery<PagedResult<Client>>({
    queryKey: ["clients", actions.toParams()],
    queryFn: () => api.get("/admin/clients", { params: actions.toParams() }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: (d: Record<string, string | boolean>) => api.post("/admin/clients", { name: d.name, companyName: d.company_name, phone: d.phone, email: d.email, city: d.city, gstin: d.gstin, emailReminder: d.email_reminder }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setShowForm(false); },
  });
  const update = useMutation({
    mutationFn: ({ id, ...d }: Record<string, string | boolean>) => api.patch(`/admin/clients/${id as string}`, { name: d.name, companyName: d.company_name, phone: d.phone, email: d.email, city: d.city, gstin: d.gstin, emailReminder: d.email_reminder }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setEditing(null); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/clients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setDeleteConfirm(null); },
  });

  const col = (label: string, key: string) => (
    <th style={th} onClick={() => actions.setSort(key)}>{label}<SortIcon col={key} sortBy={list.sortBy} sortDir={list.sortDir} /></th>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Clients</h1>
      {showForm && <ClientForm onSave={(d) => create.mutate(d)} onCancel={() => setShowForm(false)} />}
      {editing && <ClientForm initial={editing} onSave={(d) => update.mutate({ id: editing.id, ...d })} onCancel={() => setEditing(null)} />}
      {deleteConfirm && (
        <div style={{ background: "#fff3f3", border: "1px solid #fdd", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14 }}>Delete this client? This cannot be undone.</span>
          <button onClick={() => remove.mutate(deleteConfirm)} disabled={remove.isPending}
            style={{ padding: "6px 16px", background: "#c92a2a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            {remove.isPending ? "Deleting…" : "Confirm Delete"}
          </button>
          <button onClick={() => setDeleteConfirm(null)} style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 13 }}>Cancel</button>
        </div>
      )}
      <TableControls
        search={list.search} onSearch={actions.setSearch} placeholder="Search name, phone, GSTIN…"
        activeFilters={list.filters} onFilter={actions.setFilter} onReset={actions.resetFilters}
        filters={[{ key: "status", label: "Status", options: [{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }] }]}
        rightSlot={<div style={{ display: "flex", gap: 8 }}><PrintListButton /><button onClick={handleExport} disabled={exporting} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exporting ? "Exporting…" : "⬇ Export"}</button><button onClick={() => setShowForm(true)} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ New Client</button></div>}
      />
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {col("Name", "name")} {col("Company", "company_name")}
              <th style={th}>Phone</th> {col("City", "city")}
              <th style={th}>GSTIN</th> <th style={th} />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#888" }}>Loading…</td></tr>}
            {data?.data?.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ ...td, fontWeight: 500 }}>{c.name}</td>
                <td style={td}>{c.company_name || "—"}</td>
                <td style={td}>{c.phone || "—"}</td>
                <td style={td}>{c.city || "—"}</td>
                <td style={td}>{c.gstin || "—"}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <IconButton icon="✏️" tooltip="Edit" onClick={() => setEditing(c)} />
                    <IconButton icon="🗑️" tooltip="Delete" onClick={() => setDeleteConfirm(c.id)} danger />
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.data?.length && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>No clients found</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
