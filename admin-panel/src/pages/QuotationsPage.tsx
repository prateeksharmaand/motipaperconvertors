import PrintListButton from "../components/PrintListButton.tsx";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";
import { statusLabel } from "../theme.ts";
import { exportToCsv } from "../lib/exportCsv.ts";

interface Quotation { id: string; quotation_number: number; job_id: string; job_title: string; job_number: number; total: number; status: string; notes: string; paper_cost: number; plate_cost: number; printing_cost: number; gst_percent: number; discount_amount: number; margin_percent: number; }
interface JobMini { id: string; job_number: number; title: string; client_name: string; }
interface FinishingItem { name: string; amount: number; }

const STATUS_OPTIONS = [
  { label: "Draft", value: "draft" }, { label: "Sent", value: "sent" },
  { label: "Accepted", value: "accepted" }, { label: "Rejected", value: "rejected" },
];
const STATUS_COLOR: Record<string, string> = { draft: "#868e96", sent: "#1971c2", accepted: "#2b8a3e", rejected: "#c92a2a" };
const fmt = (n: number | string) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14 };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

function QuotationForm({ initial, jobs, onSave, onCancel, isPending }: {
  initial?: Partial<Quotation>; jobs: JobMini[];
  onSave: (d: Record<string, string | number | FinishingItem[]>) => void;
  onCancel: () => void; isPending: boolean;
}) {
  const [form, setForm] = useState({
    jobId: initial?.job_id ?? "", paperCost: initial?.paper_cost?.toString() ?? "0",
    plateCost: initial?.plate_cost?.toString() ?? "0", printingCost: initial?.printing_cost?.toString() ?? "0",
    marginPercent: initial?.margin_percent?.toString() ?? "", discountAmount: initial?.discount_amount?.toString() ?? "0",
    gstPercent: initial?.gst_percent?.toString() ?? "18", notes: initial?.notes ?? "",
  });
  const [finishing, setFinishing] = useState<FinishingItem[]>([]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const addFin = () => setFinishing(f => [...f, { name: "", amount: 0 }]);
  const updateFin = (i: number, k: keyof FinishingItem, v: string | number) =>
    setFinishing(f => f.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
  const removeFin = (i: number) => setFinishing(f => f.filter((_, idx) => idx !== i));

  const rawCost = Number(form.paperCost) + Number(form.plateCost) + Number(form.printingCost) + finishing.reduce((s, f) => s + Number(f.amount), 0);
  const withMargin = form.marginPercent ? rawCost * (1 + Number(form.marginPercent) / 100) : rawCost;
  const subTotal = withMargin - Number(form.discountAmount);
  const gstAmt = subTotal * Number(form.gstPercent) / 100;
  const total = subTotal + gstAmt;

  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>{initial?.id ? "Edit Quotation" : "New Quotation"}</h3>
      {!initial?.id && (
        <label style={{ display: "block", marginBottom: 16 }}><span style={{ fontSize: 13 }}>Job *</span>
          <select style={inputStyle} value={form.jobId} onChange={set("jobId")}>
            <option value="">— select job —</option>
            {jobs.map(j => <option key={j.id} value={j.id}>#{j.job_number} {j.title} {j.client_name ? `· ${j.client_name}` : ""}</option>)}
          </select>
        </label>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label><span style={{ fontSize: 13 }}>Paper Cost (₹)</span><input style={inputStyle} type="number" value={form.paperCost} onChange={set("paperCost")} /></label>
        <label><span style={{ fontSize: 13 }}>Plate Cost (₹)</span><input style={inputStyle} type="number" value={form.plateCost} onChange={set("plateCost")} /></label>
        <label><span style={{ fontSize: 13 }}>Printing Cost (₹)</span><input style={inputStyle} type="number" value={form.printingCost} onChange={set("printingCost")} /></label>
        <label><span style={{ fontSize: 13 }}>Margin %</span><input style={inputStyle} type="number" value={form.marginPercent} onChange={set("marginPercent")} /></label>
        <label><span style={{ fontSize: 13 }}>Discount (₹)</span><input style={inputStyle} type="number" value={form.discountAmount} onChange={set("discountAmount")} /></label>
        <label><span style={{ fontSize: 13 }}>GST %</span><input style={inputStyle} type="number" value={form.gstPercent} onChange={set("gstPercent")} /></label>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Finishing Items</div>
        {finishing.map((f, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr auto", gap: 8, marginBottom: 6 }}>
            <input style={inputStyle} placeholder="Name (e.g. Lamination)" value={f.name} onChange={e => updateFin(i, "name", e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Amount" value={f.amount} onChange={e => updateFin(i, "amount", Number(e.target.value))} />
            <button onClick={() => removeFin(i)} style={{ padding: "8px 10px", border: "1px solid #fdd", borderRadius: 6, cursor: "pointer", background: "#fff", color: "#c92a2a" }}>✕</button>
          </div>
        ))}
        <button onClick={addFin} style={{ padding: "6px 14px", border: "1px dashed #bbb", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 13 }}>+ Add finishing</button>
      </div>
      <label><span style={{ fontSize: 13 }}>Notes</span><textarea style={{ ...inputStyle, height: 56 }} value={form.notes} onChange={set("notes")} /></label>
      <div style={{ marginTop: 12, padding: 12, background: "#f8f9fa", borderRadius: 6, fontSize: 13, display: "flex", gap: 24 }}>
        <span>Raw Cost: <strong>{fmt(rawCost)}</strong></span>
        <span>After Margin: <strong>{fmt(withMargin)}</strong></span>
        <span>GST: <strong>{fmt(gstAmt)}</strong></span>
        <span style={{ fontWeight: 800, color: "#1971c2" }}>Total: {fmt(total)}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => onSave({ ...form, finishingItems: finishing, paperCost: Number(form.paperCost), plateCost: Number(form.plateCost), printingCost: Number(form.printingCost), marginPercent: form.marginPercent ? Number(form.marginPercent) : "", discountAmount: Number(form.discountAmount), gstPercent: Number(form.gstPercent) })}
          disabled={(!initial?.id && !form.jobId) || isPending}
          style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          {isPending ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

export default function QuotationsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get("/admin/quotations", { params: { limit: 5000 } });
      const list: Quotation[] = res.data.data ?? [];
      const date = new Date().toISOString().slice(0, 10);
      exportToCsv(`quotations-${date}.csv`, list.map(q => ({
        quotation_number: q.quotation_number, job_title: q.job_title,
        total: q.total, status: q.status, notes: q.notes, created_at: "",
      })));
    } finally { setExporting(false); }
  }
  const [list, actions] = useListState({ sortBy: "created_at", filters: {} });

  const { data, isLoading } = useQuery<PagedResult<Quotation>>({
    queryKey: ["quotations", actions.toParams()],
    queryFn: () => api.get("/admin/quotations", { params: actions.toParams() }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const { data: jobs = [] } = useQuery<JobMini[]>({
    queryKey: ["jobs-mini"],
    queryFn: () => api.get("/admin/jobs", { params: { limit: "300" } }).then(r => r.data.data ?? []),
  });

  const create = useMutation({
    mutationFn: (d: Record<string, string | number | FinishingItem[]>) => api.post("/admin/quotations", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotations"] }); setShowForm(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }: Record<string, string | number | FinishingItem[]>) => api.patch(`/admin/quotations/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotations"] }); setEditing(null); },
  });

  const col = (label: string, key: string) => (
    <th style={th} onClick={() => actions.setSort(key)}>{label}<SortIcon col={key} sortBy={list.sortBy} sortDir={list.sortDir} /></th>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Quotations</h1>
      {showForm && <QuotationForm jobs={jobs} isPending={create.isPending} onSave={(d) => create.mutate(d)} onCancel={() => setShowForm(false)} />}
      {editing && <QuotationForm initial={editing} jobs={jobs} isPending={update.isPending} onSave={(d) => update.mutate({ id: editing.id, ...d })} onCancel={() => setEditing(null)} />}
      <TableControls
        search={list.search} onSearch={actions.setSearch} placeholder="Search job, notes…"
        activeFilters={list.filters} onFilter={actions.setFilter} onReset={actions.resetFilters}
        filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        rightSlot={<div style={{ display: "flex", gap: 8 }}><PrintListButton /><button onClick={handleExport} disabled={exporting} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exporting ? "Exporting…" : "⬇ Export"}</button><button onClick={() => setShowForm(true)} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ New Quotation</button></div>}
      />
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {col("#", "quotation_number")} <th style={th}>Job</th>
              {col("Total", "total")} {col("Status", "status")} <th style={th} />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#888" }}>Loading…</td></tr>}
            {data?.data?.map((q) => (
              <tr key={q.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ ...td, color: "#888" }}>Q-{q.quotation_number}</td>
                <td style={{ ...td, fontWeight: 500 }}>#{q.job_number} {q.job_title}</td>
                <td style={{ ...td, fontWeight: 600 }}>{fmt(q.total)}</td>
                <td style={td}>
                  <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: (STATUS_COLOR[q.status] ?? "#868e96") + "22", color: STATUS_COLOR[q.status] ?? "#868e96" }}>{statusLabel(q.status)}</span>
                </td>
                <td style={td}>
                  <button onClick={() => setEditing(q)} style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff" }}>Edit</button>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.data?.length && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>No quotations found</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
