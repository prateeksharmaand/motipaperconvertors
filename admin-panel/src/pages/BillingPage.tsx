import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import InvoicePrintView from "./InvoicePrintView.tsx";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";
import { statusLabel } from "../theme.ts";
import { exportToCsv } from "../lib/exportCsv.ts";

type Tab = "invoices" | "payments" | "ledger";
const STATUS_COLOR: Record<string, string> = { draft: "#868e96", issued: "#1971c2", partially_paid: "#f59f00", paid: "#2b8a3e", cancelled: "#c92a2a" };
const fmt = (n: number | string) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14 };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

interface Invoice { id: string; invoice_number: number; client_name: string; client_id: string; job_id: string; total: number; amount_paid: number; balance_due: number; status: string; due_date: string; issue_date: string; notes: string; gst_percent: number; discount_amount: number; line_items: LineItem[]; }
interface Payment { id: string; client_name: string; amount: number; payment_mode: string; type: string; payment_date: string; reference_number: string; }
interface Client  { id: string; name: string; }
interface JobMini { id: string; job_number: number; title: string; }
interface LineItem { description: string; qty: number; rate: number; amount: number; }

function InvoiceForm({ clients, initial, onClose }: { clients: Client[]; initial?: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [form, setForm] = useState({
    clientId: initial?.client_id ?? "",
    jobId: initial?.job_id ?? "",
    dueDate: initial?.due_date?.slice(0, 10) ?? "",
    notes: initial?.notes ?? "",
    gstPercent: String(initial?.gst_percent ?? 18),
    discountAmount: String(initial?.discount_amount ?? 0),
  });
  const [lines, setLines] = useState<LineItem[]>(
    initial?.line_items?.length ? initial.line_items : [{ description: "", qty: 1, rate: 0, amount: 0 }]
  );
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: jobs = [] } = useQuery<JobMini[]>({
    queryKey: ["jobs-all"],
    queryFn: () => api.get("/admin/jobs", { params: { limit: "200", status: "ready" } }).then(r => r.data.data ?? []),
  });

  const updateLine = (i: number, k: keyof LineItem, v: string | number) => {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [k]: v };
      if (k === "qty" || k === "rate") updated.amount = Number(updated.qty) * Number(updated.rate);
      return updated;
    }));
  };
  const addLine = () => setLines(ls => [...ls, { description: "", qty: 1, rate: 0, amount: 0 }]);
  const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i));

  const payload = {
    clientId: form.clientId, jobId: form.jobId || undefined,
    dueDate: form.dueDate || undefined, notes: form.notes || undefined,
    gstPercent: Number(form.gstPercent), discountAmount: Number(form.discountAmount),
    lineItems: lines,
  };

  const save = useMutation({
    mutationFn: () => isEdit
      ? api.patch(`/admin/billing/invoices/${initial!.id}`, payload)
      : api.post("/admin/billing/invoices", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); onClose(); },
  });

  const subTotal = lines.reduce((s, l) => s + l.amount, 0) - Number(form.discountAmount);
  const gstAmt = subTotal * Number(form.gstPercent) / 100;
  const total = subTotal + gstAmt;

  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>{isEdit ? `Edit Invoice #${initial!.invoice_number}` : "New Invoice"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label><span style={{ fontSize: 13 }}>Client *</span>
          <select style={inputStyle} value={form.clientId} onChange={set("clientId")}>
            <option value="">— select client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label><span style={{ fontSize: 13 }}>Job (Ready)</span>
          <select style={inputStyle} value={form.jobId} onChange={set("jobId")}>
            <option value="">— optional —</option>
            {jobs.map(j => <option key={j.id} value={j.id}>#{j.job_number} {j.title}</option>)}
          </select>
        </label>
        <label><span style={{ fontSize: 13 }}>Due Date</span><input style={inputStyle} type="date" value={form.dueDate} onChange={set("dueDate")} /></label>
        <label><span style={{ fontSize: 13 }}>GST %</span><input style={inputStyle} type="number" value={form.gstPercent} onChange={set("gstPercent")} /></label>
        <label><span style={{ fontSize: 13 }}>Discount (₹)</span><input style={inputStyle} type="number" value={form.discountAmount} onChange={set("discountAmount")} /></label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Line Items</div>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input style={inputStyle} placeholder="Description" value={l.description} onChange={e => updateLine(i, "description", e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Qty" value={l.qty} onChange={e => updateLine(i, "qty", Number(e.target.value))} />
            <input style={inputStyle} type="number" placeholder="Rate" value={l.rate} onChange={e => updateLine(i, "rate", Number(e.target.value))} />
            <div style={{ padding: "8px 12px", border: "1px solid #eee", borderRadius: 6, fontSize: 14, background: "#f8f9fa" }}>{fmt(l.amount)}</div>
            {lines.length > 1 && <button onClick={() => removeLine(i)} style={{ padding: "8px 10px", border: "1px solid #fdd", borderRadius: 6, cursor: "pointer", background: "#fff", color: "#c92a2a", fontSize: 13 }}>✕</button>}
          </div>
        ))}
        <button onClick={addLine} style={{ padding: "6px 14px", border: "1px dashed #bbb", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 13 }}>+ Add line</button>
      </div>
      <label><span style={{ fontSize: 13 }}>Notes</span><textarea style={{ ...inputStyle, height: 56 }} value={form.notes} onChange={set("notes")} /></label>
      <div style={{ marginTop: 12, padding: 12, background: "#f8f9fa", borderRadius: 6, fontSize: 13, display: "flex", gap: 24 }}>
        <span>Subtotal: <strong>{fmt(subTotal)}</strong></span>
        <span>GST {form.gstPercent}%: <strong>{fmt(gstAmt)}</strong></span>
        <span style={{ fontWeight: 800, color: "#1971c2" }}>Total: {fmt(total)}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => save.mutate()} disabled={!form.clientId || lines.length === 0 || save.isPending}
          style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          {save.isPending ? "Saving…" : isEdit ? "Update Invoice" : "Create Invoice"}
        </button>
        <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

function RecordPaymentForm({ invoiceId, clientId, onClose }: { invoiceId: string; clientId: string; onClose: () => void }) {
  const [form, setForm] = useState({ amount: "", paymentMode: "cash", referenceNumber: "", notes: "" });
  const qc = useQueryClient();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => api.post("/admin/billing/payments", { invoiceId, clientId, amount: Number(form.amount), paymentMode: form.paymentMode, type: "against_invoice", referenceNumber: form.referenceNumber || undefined, notes: form.notes || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["payments"] }); onClose(); },
  });
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>Record Payment</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label><span style={{ fontSize: 13 }}>Amount (₹) *</span><input style={inputStyle} type="number" value={form.amount} onChange={set("amount")} /></label>
        <label><span style={{ fontSize: 13 }}>Mode</span>
          <select style={inputStyle} value={form.paymentMode} onChange={set("paymentMode")}>
            {["cash","upi","cheque","neft","rtgs","other"].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
          </select>
        </label>
        <label><span style={{ fontSize: 13 }}>Ref / Cheque No.</span><input style={inputStyle} value={form.referenceNumber} onChange={set("referenceNumber")} /></label>
        <label><span style={{ fontSize: 13 }}>Notes</span><input style={inputStyle} value={form.notes} onChange={set("notes")} /></label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => save.mutate()} disabled={!form.amount || save.isPending} style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>{save.isPending ? "Saving…" : "Record Payment"}</button>
        <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>("invoices");
  const [paymentFor, setPaymentFor] = useState<{ invoiceId: string; clientId: string } | null>(null);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [ledgerClientId, setLedgerClientId] = useState("");
  const [exportingInvoices, setExportingInvoices] = useState(false);
  const [exportingPayments, setExportingPayments] = useState(false);

  async function handleExportInvoices() {
    setExportingInvoices(true);
    try {
      const res = await api.get("/admin/billing/invoices", { params: { limit: 5000 } });
      const list: Invoice[] = res.data.data ?? [];
      const date = new Date().toISOString().slice(0, 10);
      exportToCsv(`invoices-${date}.csv`, list.map(i => ({
        invoice_number: i.invoice_number, client_name: i.client_name,
        total: i.total, amount_paid: i.amount_paid, balance_due: i.balance_due,
        status: i.status, issue_date: i.issue_date, due_date: i.due_date,
      })));
    } finally { setExportingInvoices(false); }
  }

  async function handleExportPayments() {
    setExportingPayments(true);
    try {
      const res = await api.get("/admin/billing/payments", { params: { limit: 5000 } });
      const list: Payment[] = res.data.data ?? [];
      const date = new Date().toISOString().slice(0, 10);
      exportToCsv(`payments-${date}.csv`, list.map(p => ({
        payment_date: p.payment_date, client_name: p.client_name,
        amount: p.amount, payment_mode: p.payment_mode, type: p.type,
        reference_number: p.reference_number, notes: "",
      })));
    } finally { setExportingPayments(false); }
  }
  const [invList, invActions] = useListState({ sortBy: "created_at" });
  const [payList, payActions] = useListState({ sortBy: "payment_date" });

  const { data: invoices, isLoading: invLoading } = useQuery<PagedResult<Invoice>>({
    queryKey: ["invoices", invActions.toParams()],
    queryFn: () => api.get("/admin/billing/invoices", { params: invActions.toParams() }).then(r => r.data),
    placeholderData: keepPreviousData,
  });
  const { data: payments } = useQuery<PagedResult<Payment>>({
    queryKey: ["payments", payActions.toParams()],
    queryFn: () => api.get("/admin/billing/payments", { params: payActions.toParams() }).then(r => r.data),
    placeholderData: keepPreviousData,
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-mini"],
    queryFn: () => api.get("/admin/clients", { params: { limit: "200" } }).then(r => r.data.data ?? []),
  });
  const { data: printTemplate } = useQuery<{ header: string | null; footer: string | null; signature: string | null }>({
    queryKey: ["print-template"],
    queryFn: () => api.get("/admin/settings/print-template").then(r => r.data),
  });
  const { data: ledger } = useQuery({
    queryKey: ["ledger", ledgerClientId],
    queryFn: () => ledgerClientId ? api.get(`/admin/billing/ledger/${ledgerClientId}`).then(r => r.data) : null,
    enabled: !!ledgerClientId,
  });

  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: tab === t ? "#3b5bdb" : "#eee", color: tab === t ? "#fff" : "#444", fontWeight: 600, cursor: "pointer" }}>{label}</button>
  );
  const invCol = (label: string, key: string) => <th style={th} onClick={() => invActions.setSort(key)}>{label}<SortIcon col={key} sortBy={invList.sortBy} sortDir={invList.sortDir} /></th>;
  const payCol = (label: string, key: string) => <th style={th} onClick={() => payActions.setSort(key)}>{label}<SortIcon col={key} sortBy={payList.sortBy} sortDir={payList.sortDir} /></th>;

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Billing & Khata</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>{tabBtn("invoices", "Invoices")}{tabBtn("payments", "Payments")}{tabBtn("ledger", "Client Ledger")}</div>

      {tab === "invoices" && (
        <>
          {showNewInvoice && <InvoiceForm clients={clients} onClose={() => setShowNewInvoice(false)} />}
          {editingInvoice && <InvoiceForm clients={clients} initial={editingInvoice} onClose={() => setEditingInvoice(null)} />}
          {paymentFor && <RecordPaymentForm invoiceId={paymentFor.invoiceId} clientId={paymentFor.clientId} onClose={() => setPaymentFor(null)} />}
          <TableControls search={invList.search} onSearch={invActions.setSearch} placeholder="Search client, invoice #…"
            activeFilters={invList.filters} onFilter={invActions.setFilter} onReset={invActions.resetFilters}
            filters={[
              { key: "status", label: "Status", options: [{ label: "Issued", value: "issued" }, { label: "Partial", value: "partially_paid" }, { label: "Paid", value: "paid" }, { label: "Cancelled", value: "cancelled" }] },
              { key: "overdue", label: "Overdue", options: [{ label: "Overdue only", value: "1" }] },
            ]}
            rightSlot={<div style={{ display: "flex", gap: 8 }}><button onClick={handleExportInvoices} disabled={exportingInvoices} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exportingInvoices ? "Exporting…" : "⬇ Export"}</button><button onClick={() => setShowNewInvoice(true)} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ New Invoice</button></div>} />
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>Due from <input type="date" value={invList.filters.dueDateFrom ?? ""} onChange={e => invActions.setFilter("dueDateFrom", e.target.value)} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} /></label>
            <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>to <input type="date" value={invList.filters.dueDateTo ?? ""} onChange={e => invActions.setFilter("dueDateTo", e.target.value)} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} /></label>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {invCol("#", "invoice_number")} <th style={th}>Client</th>
                {invCol("Total", "total")} <th style={th}>Paid</th>
                {invCol("Balance", "balance_due")} {invCol("Status", "status")}
                {invCol("Due", "due_date")} <th style={th} />
              </tr></thead>
              <tbody>
                {invLoading && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#888" }}>Loading…</td></tr>}
                {invoices?.data?.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ ...td, color: "#888" }}>#{inv.invoice_number}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{inv.client_name}</td>
                    <td style={td}>{fmt(inv.total)}</td>
                    <td style={{ ...td, color: "#2b8a3e" }}>{fmt(inv.amount_paid)}</td>
                    <td style={{ ...td, fontWeight: 600, color: Number(inv.balance_due) > 0 ? "#c92a2a" : "#2b8a3e" }}>{fmt(inv.balance_due)}</td>
                    <td style={td}><span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: (STATUS_COLOR[inv.status] ?? "#868e96") + "22", color: STATUS_COLOR[inv.status] ?? "#868e96" }}>{statusLabel(inv.status)}</span></td>
                    <td style={td}>{inv.due_date || "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setEditingInvoice(inv)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }}>Edit</button>
                        {inv.status !== "paid" && inv.status !== "cancelled" && <button onClick={() => setPaymentFor({ invoiceId: inv.id, clientId: inv.client_id })} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }}>+ Pay</button>}
                        <button onClick={() => setPrintInvoice(inv)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }} title="Print Invoice">Print</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!invLoading && !invoices?.data?.length && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>No invoices</td></tr>}
              </tbody>
            </table>
          </div>
          {invoices && <Pagination page={invoices.page} totalPages={invoices.totalPages} total={invoices.total} limit={invoices.limit} onPage={invActions.setPage} />}
        </>
      )}

      {tab === "payments" && (
        <>
          <TableControls search={payList.search} onSearch={payActions.setSearch} placeholder="Search client, reference…"
            activeFilters={payList.filters} onFilter={payActions.setFilter} onReset={payActions.resetFilters}
            filters={[{ key: "paymentMode", label: "Mode", options: [{ label: "Cash", value: "cash" }, { label: "UPI", value: "upi" }, { label: "Cheque", value: "cheque" }, { label: "NEFT", value: "neft" }] }]}
            rightSlot={<button onClick={handleExportPayments} disabled={exportingPayments} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exportingPayments ? "Exporting…" : "⬇ Export"}</button>} />
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {payCol("Date", "payment_date")} <th style={th}>Client</th>
                {payCol("Amount", "amount")} {payCol("Mode", "payment_mode")}
                <th style={th}>Type</th> <th style={th}>Reference</th>
              </tr></thead>
              <tbody>
                {payments?.data?.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={td}>{new Date(p.payment_date).toLocaleDateString("en-IN")}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{p.client_name}</td>
                    <td style={{ ...td, fontWeight: 600, color: "#2b8a3e" }}>{fmt(p.amount)}</td>
                    <td style={td}>{p.payment_mode.toUpperCase()}</td>
                    <td style={td}>{p.type}</td>
                    <td style={{ ...td, color: "#888" }}>{p.reference_number || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments && <Pagination page={payments.page} totalPages={payments.totalPages} total={payments.total} limit={payments.limit} onPage={payActions.setPage} />}
        </>
      )}

      {printInvoice && (
        <InvoicePrintView
          invoice={printInvoice}
          template={printTemplate ?? { header: null, footer: null, signature: null }}
          onClose={() => setPrintInvoice(null)}
        />
      )}

      {tab === "ledger" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, marginRight: 8 }}>Select Client</label>
            <select style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, minWidth: 220 }} value={ledgerClientId} onChange={e => setLedgerClientId(e.target.value)}>
              <option value="">— choose —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {ledger && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
                {[{ label: "Total Billed", value: fmt(ledger.summary.totalBilled), color: "#1971c2" }, { label: "Total Paid", value: fmt(ledger.summary.totalPaid), color: "#2b8a3e" }, { label: "Outstanding", value: fmt(ledger.summary.outstanding), color: ledger.summary.outstanding > 0 ? "#c92a2a" : "#2b8a3e" }].map(s => (
                  <div key={s.label} style={{ background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: `3px solid ${s.color}` }}>
                    <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>{["#","Date","Total","Paid","Balance","Status"].map(h => <th key={h} style={{ ...th, cursor: "default" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {ledger.invoices.map((i: Invoice) => (
                    <tr key={i.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={td}>#{i.invoice_number}</td>
                      <td style={td}>{i.issue_date}</td>
                      <td style={td}>{fmt(i.total)}</td>
                      <td style={{ ...td, color: "#2b8a3e" }}>{fmt(i.amount_paid)}</td>
                      <td style={{ ...td, fontWeight: 600, color: Number(i.balance_due) > 0 ? "#c92a2a" : "#555" }}>{fmt(i.balance_due)}</td>
                      <td style={td}><span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: (STATUS_COLOR[i.status] ?? "#868e96") + "22", color: STATUS_COLOR[i.status] ?? "#868e96" }}>{statusLabel(i.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
