import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";

const STATUS_OPTIONS = [
  { label: "Enquiry", value: "enquiry" }, { label: "Quotation", value: "quotation" },
  { label: "Design", value: "design" }, { label: "Approval", value: "approval" },
  { label: "Print", value: "print" }, { label: "Finishing", value: "finishing" },
  { label: "QC", value: "qc" }, { label: "Ready", value: "ready" },
  { label: "Delivered", value: "delivered" }, { label: "Cancelled", value: "cancelled" },
];

const STATUS_COLOR: Record<string, string> = {
  enquiry: "#868e96", quotation: "#1971c2", design: "#7048e8", approval: "#f59f00",
  print: "#2f9e44", finishing: "#0c8599", qc: "#e67700", ready: "#2b8a3e",
  delivered: "#1864ab", cancelled: "#c92a2a",
};

type Job = { id: string; job_number: number; title: string; client_name: string; client_id: string; status: string; due_date: string; quoted_price: number; operator_name: string; description: string; job_type: string; size: string; quantity: number; };
interface Client { id: string; name: string; }

const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14 };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

function JobForm({ initial, clients, onSave, onCancel, isPending }: {
  initial?: Partial<Job>; clients: Client[];
  onSave: (d: Record<string, string>) => void; onCancel: () => void; isPending: boolean;
}) {
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? "",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    job_type: initial?.job_type ?? "",
    size: initial?.size ?? "",
    quantity: initial?.quantity?.toString() ?? "",
    due_date: initial?.due_date ?? "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>{initial?.id ? "Edit Job" : "New Job"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <label><span style={{ fontSize: 13 }}>Client</span>
          <select style={inputStyle} value={form.client_id} onChange={set("client_id")}>
            <option value="">— select client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label><span style={{ fontSize: 13 }}>Title *</span><input style={inputStyle} value={form.title} onChange={set("title")} /></label>
        <label><span style={{ fontSize: 13 }}>Job Type</span><input style={inputStyle} placeholder="e.g. brochure, business card" value={form.job_type} onChange={set("job_type")} /></label>
        <label><span style={{ fontSize: 13 }}>Paper Size</span><input style={inputStyle} placeholder="e.g. A4, A3" value={form.size} onChange={set("size")} /></label>
        <label><span style={{ fontSize: 13 }}>Quantity</span><input style={inputStyle} type="number" value={form.quantity} onChange={set("quantity")} /></label>
        <label><span style={{ fontSize: 13 }}>Due Date</span><input style={inputStyle} type="date" value={form.due_date} onChange={set("due_date")} /></label>
      </div>
      <label><span style={{ fontSize: 13 }}>Description</span>
        <textarea style={{ ...inputStyle, height: 64 }} value={form.description} onChange={set("description")} />
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => onSave(form as unknown as Record<string, string>)} disabled={!form.title || isPending}
          style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          {isPending ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const qc = useQueryClient();
  const [list, actions] = useListState({ sortBy: "created_at", filters: {} });

  const { data, isLoading } = useQuery<PagedResult<Job>>({
    queryKey: ["jobs", actions.toParams()],
    queryFn: () => api.get("/admin/jobs", { params: actions.toParams() }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-mini"],
    queryFn: () => api.get("/admin/clients", { params: { limit: "200" } }).then(r => r.data.data ?? []),
  });

  const create = useMutation({
    mutationFn: (d: Record<string, string>) => api.post("/admin/jobs", {
      clientId: d.client_id || undefined, title: d.title, description: d.description || undefined,
      jobType: d.job_type || undefined, size: d.size || undefined,
      quantity: d.quantity ? Number(d.quantity) : undefined, dueDate: d.due_date || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setShowForm(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }: Record<string, string>) => api.patch(`/admin/jobs/${id}`, {
      title: d.title, description: d.description || undefined,
      size: d.size || undefined, job_type: d.job_type || undefined,
      quantity: d.quantity ? Number(d.quantity) : undefined, due_date: d.due_date || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/jobs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setDeleteConfirm(null); },
  });

  const col = (label: string, key: string) => (
    <th style={th} onClick={() => actions.setSort(key)}>
      {label}<SortIcon col={key} sortBy={list.sortBy} sortDir={list.sortDir} />
    </th>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Job Cards</h1>
      {showForm && <JobForm clients={clients} isPending={create.isPending} onSave={(d) => create.mutate(d)} onCancel={() => setShowForm(false)} />}
      {editing && <JobForm initial={editing} clients={clients} isPending={update.isPending} onSave={(d) => update.mutate({ id: editing.id, ...d })} onCancel={() => setEditing(null)} />}
      {deleteConfirm && (
        <div style={{ background: "#fff3f3", border: "1px solid #fdd", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14 }}>Delete this job? This cannot be undone.</span>
          <button onClick={() => remove.mutate(deleteConfirm)} disabled={remove.isPending}
            style={{ padding: "6px 16px", background: "#c92a2a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            {remove.isPending ? "Deleting…" : "Confirm Delete"}
          </button>
          <button onClick={() => setDeleteConfirm(null)} style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 13 }}>Cancel</button>
        </div>
      )}
      <TableControls
        search={list.search} onSearch={actions.setSearch} placeholder="Search jobs, clients…"
        activeFilters={list.filters} onFilter={actions.setFilter} onReset={actions.resetFilters}
        filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        rightSlot={<button onClick={() => setShowForm(true)} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ New Job</button>}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
          Due from <input type="date" value={list.filters.dueDateFrom ?? ""} onChange={(e) => actions.setFilter("dueDateFrom", e.target.value)} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
          to <input type="date" value={list.filters.dueDateTo ?? ""} onChange={(e) => actions.setFilter("dueDateTo", e.target.value)} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        </label>
      </div>
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {col("#", "job_number")} {col("Title", "title")}
              <th style={th}>Client</th> {col("Status", "status")}
              {col("Due", "due_date")} {col("Quoted", "quoted_price")}
              <th style={th}>Operator</th> <th style={th} />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#888" }}>Loading…</td></tr>}
            {data?.data?.map((j) => (
              <tr key={j.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ ...td, color: "#888" }}>{j.job_number}</td>
                <td style={{ ...td, fontWeight: 500 }}>{j.title}</td>
                <td style={td}>{j.client_name ?? "—"}</td>
                <td style={td}>
                  <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: (STATUS_COLOR[j.status] ?? "#868e96") + "22", color: STATUS_COLOR[j.status] ?? "#868e96" }}>{j.status}</span>
                </td>
                <td style={td}>{j.due_date ?? "—"}</td>
                <td style={td}>{j.quoted_price ? "₹" + Number(j.quoted_price).toLocaleString("en-IN") : "—"}</td>
                <td style={td}>{j.operator_name ?? "—"}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditing(j)} style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff" }}>Edit</button>
                    <button onClick={() => setDeleteConfirm(j.id)} style={{ padding: "4px 10px", border: "1px solid #fdd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff", color: "#c92a2a" }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.data?.length && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>No jobs found</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
