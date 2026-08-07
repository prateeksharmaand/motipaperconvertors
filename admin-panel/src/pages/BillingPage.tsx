import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";

type Tab = "invoices" | "payments" | "ledger";
const STATUS_COLOR: Record<string, string> = { draft: "#868e96", issued: "#1971c2", partially_paid: "#f59f00", paid: "#2b8a3e", cancelled: "#c92a2a" };
const fmt = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14 };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

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
            {["cash", "upi", "cheque", "neft", "rtgs", "other"].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
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
  const [ledgerClientId, setLedgerClientId] = useState("");

  const [invList, invActions] = useListState({ sortBy: "created_at" });
  const [payList, payActions] = useListState({ sortBy: "payment_date" });

  const { data: invoices, isLoading: invLoading } = useQuery({
    queryKey: ["invoices", invActions.toParams()],
    queryFn: () => api.get("/admin/billing/invoices", { params: invActions.toParams() }).then(r => r.data),
    keepPreviousData: true,
  });
  const { data: payments } = useQuery({
    queryKey: ["payments", payActions.toParams()],
    queryFn: () => api.get("/admin/billing/payments", { params: payActions.toParams() }).then(r => r.data),
    keepPreviousData: true,
  });
  const { data: clients = [] } = useQuery({ queryKey: ["clients-mini"], queryFn: () => api.get("/admin/clients", { params: { limit: "200" } }).then(r => r.data.data) });
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
          {paymentFor && <RecordPaymentForm invoiceId={paymentFor.invoiceId} clientId={paymentFor.clientId} onClose={() => setPaymentFor(null)} />}
          <TableControls search={invList.search} onSearch={invActions.setSearch} placeholder="Search client, invoice #…"
            activeFilters={invList.filters} onFilter={invActions.setFilter} onReset={invActions.resetFilters}
            filters={[
              { key: "status", label: "Status", options: [{ label: "Issued", value: "issued" }, { label: "Partial", value: "partially_paid" }, { label: "Paid", value: "paid" }, { label: "Cancelled", value: "cancelled" }] },
              { key: "invoiceType", label: "Type", options: [{ label: "Job Work", value: "job_work" }, { label: "Goods", value: "goods" }] },
              { key: "overdue", label: "Overdue", options: [{ label: "Overdue only", value: "1" }] },
            ]} />
          {/* Due date range */}
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
                {invoices?.data?.map((inv: Record<string, string | number>) => (
                  <tr key={inv.id as string} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ ...td, color: "#888" }}>#{inv.invoice_number}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{inv.client_name as string}</td>
                    <td style={td}>{fmt(inv.total as number)}</td>
                    <td style={{ ...td, color: "#2b8a3e" }}>{fmt(inv.amount_paid as number)}</td>
                    <td style={{ ...td, fontWeight: 600, color: Number(inv.balance_due) > 0 ? "#c92a2a" : "#2b8a3e" }}>{fmt(inv.balance_due as number)}</td>
                    <td style={td}><span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: (STATUS_COLOR[inv.status as string] ?? "#868e96") + "22", color: STATUS_COLOR[inv.status as string] ?? "#868e96" }}>{inv.status as string}</span></td>
                    <td style={td}>{(inv.due_date as string) || "—"}</td>
                    <td style={td}>{inv.status !== "paid" && inv.status !== "cancelled" && <button onClick={() => setPaymentFor({ invoiceId: inv.id as string, clientId: inv.client_id as string })} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }}>+ Pay</button>}</td>
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
            filters={[
              { key: "paymentMode", label: "Mode", options: [{ label: "Cash", value: "cash" }, { label: "UPI", value: "upi" }, { label: "Cheque", value: "cheque" }, { label: "NEFT", value: "neft" }, { label: "RTGS", value: "rtgs" }] },
              { key: "type", label: "Type", options: [{ label: "Against Invoice", value: "against_invoice" }, { label: "Advance", value: "advance" }, { label: "Adjustment", value: "adjustment" }] },
            ]} />
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>From <input type="date" value={payList.filters.dateFrom ?? ""} onChange={e => payActions.setFilter("dateFrom", e.target.value)} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} /></label>
            <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>To <input type="date" value={payList.filters.dateTo ?? ""} onChange={e => payActions.setFilter("dateTo", e.target.value)} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} /></label>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {payCol("Date", "payment_date")} <th style={th}>Client</th>
                {payCol("Amount", "amount")} {payCol("Mode", "payment_mode")}
                <th style={th}>Type</th> <th style={th}>Reference</th>
              </tr></thead>
              <tbody>
                {payments?.data?.map((p: Record<string, string | number>) => (
                  <tr key={p.id as string} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={td}>{new Date(p.payment_date as string).toLocaleDateString("en-IN")}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{p.client_name as string}</td>
                    <td style={{ ...td, fontWeight: 600, color: "#2b8a3e" }}>{fmt(p.amount as number)}</td>
                    <td style={td}>{(p.payment_mode as string).toUpperCase()}</td>
                    <td style={td}>{p.type as string}</td>
                    <td style={{ ...td, color: "#888" }}>{(p.reference_number as string) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments && <Pagination page={payments.page} totalPages={payments.totalPages} total={payments.total} limit={payments.limit} onPage={payActions.setPage} />}
        </>
      )}

      {tab === "ledger" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, marginRight: 8 }}>Select Client</label>
            <select style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, minWidth: 220 }} value={ledgerClientId} onChange={e => setLedgerClientId(e.target.value)}>
              <option value="">— choose —</option>
              {(clients as { id: string; name: string }[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                  {["#", "Date", "Total", "Paid", "Balance", "Status"].map(h => <th key={h} style={{ ...th, cursor: "default" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {ledger.invoices.map((i: Record<string, string | number>) => (
                    <tr key={i.id as string} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={td}>#{i.invoice_number}</td> <td style={td}>{i.issue_date as string}</td>
                      <td style={td}>{fmt(i.total as number)}</td> <td style={{ ...td, color: "#2b8a3e" }}>{fmt(i.amount_paid as number)}</td>
                      <td style={{ ...td, fontWeight: 600, color: Number(i.balance_due) > 0 ? "#c92a2a" : "#555" }}>{fmt(i.balance_due as number)}</td>
                      <td style={td}><span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: (STATUS_COLOR[i.status as string] ?? "#868e96") + "22", color: STATUS_COLOR[i.status as string] ?? "#868e96" }}>{i.status as string}</span></td>
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
