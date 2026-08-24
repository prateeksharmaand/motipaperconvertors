import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { exportToCsv } from "../lib/exportCsv.ts";
import { fmtDate } from "../lib/fmtDate.ts";
import PrintListButton from "../components/PrintListButton.tsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

// ── helpers ──────────────────────────────────────────────
function fmt(n: number | string | null | undefined) {
  return "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
const moneyFmt = (v: number | string) => `₹${Number(v ?? 0).toLocaleString("en-IN")}`;
const countFmt = (v: number | string) => String(v ?? 0);
const axisTickStyle = { fontSize: 11, fill: "#6b7280" };
const gridStyle = { stroke: "#f3f4f6", strokeDasharray: "3 3" };
const exportBtnStyle: React.CSSProperties = {
  padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7,
  cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500,
  color: "#374151", display: "flex", alignItems: "center", gap: 6,
};
const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 20, marginBottom: 20,
};
const sectionHead = (title: string, children?: React.ReactNode) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
    <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
    {children}
  </div>
);

const STATUS_COLOR: Record<string, string> = {
  enquiry: "#868e96", quotation: "#1971c2", design: "#7048e8", approval: "#f59f00",
  print: "#2f9e44", finishing: "#0c8599", qc: "#e67700", ready: "#2b8a3e",
  delivered: "#1864ab", cancelled: "#c92a2a",
};
const PIE_OUTSTANDING_COLORS: Record<string, string> = {
  issued: "#1971c2", partially_paid: "#f59e0b", overdue: "#ef4444",
};
const PIE_OUTSTANDING_LABELS: Record<string, string> = {
  issued: "Issued", partially_paid: "Partially Paid", overdue: "Overdue",
};

// ── types ─────────────────────────────────────────────────
type OutstandingInvoice = { id: string; client_name: string; invoice_number: number; balance_due: number; due_date: string; urgency: string; };
type ProfitabilityJob = { id: string; job_number: number; title: string; client_name: string; quoted_price: number; computed_cost: number; actual_margin: number; margin_percent: number; };
type MachineRow = { machine_id: string; machine_name: string; total_jobs: number; completed_jobs: number; active_jobs: number; };
type ClientRevRow = { client_id: string; client_name: string; total_invoices: number; total_billed: number; total_paid: number; total_outstanding: number; };
type StatusRow = { status: string; count: number; total_value: number; };
type PaperRow = { paper_stock_id: string; paper_name: string; gsm: number; size: string; unit: string; usage_count: number; total_sheets: number; };
type MonthRow = { month: string; revenue: number; collected: number; invoice_count: number; };

// ── stat card ─────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: `3px solid ${color}`, minWidth: 160 }}>
      <div style={{ fontSize: 13, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ── DrillDown modal ───────────────────────────────────────
type DrillDownConfig = {
  title: string;
  queryKey: unknown[];
  queryFn: () => Promise<unknown[]>;
  columns: { label: string; key: string; fmt?: (v: unknown) => string }[];
};

function DrillDownModal({ config, onClose }: { config: DrillDownConfig; onClose: () => void }) {
  const { data = [], isLoading } = useQuery<unknown[]>({
    queryKey: config.queryKey,
    queryFn: config.queryFn,
  });
  const rows = data as Record<string, unknown>[];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 900, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{config.title}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            {rows.length > 0 && (
              <button onClick={() => exportToCsv(`${config.title.replace(/\s+/g, "-").toLowerCase()}.csv`, rows)}
                style={{ padding: "6px 12px", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 12 }}>⬇ Export</button>
            )}
            <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: 0 }}>
          {isLoading && <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Loading…</div>}
          {!isLoading && rows.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#888" }}>No records found</div>}
          {rows.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", position: "sticky", top: 0 }}>
                  {config.columns.map(c => (
                    <th key={c.key} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "2px solid #e5e7eb" }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    {config.columns.map(c => (
                      <td key={c.key} style={{ padding: "11px 16px", fontSize: 13 }}>
                        {c.fmt ? c.fmt(row[c.key]) : (row[c.key] != null ? String(row[c.key]) : "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > 0 && (
            <div style={{ padding: "10px 16px", fontSize: 12, color: "#9ca3af", borderTop: "1px solid #f3f4f6" }}>
              {rows.length} record{rows.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { key: "monthly",     label: "Monthly Revenue" },
  { key: "pipeline",    label: "Job Pipeline" },
  { key: "clients",     label: "Revenue by Client" },
  { key: "outstanding", label: "Outstanding" },
  { key: "profitability", label: "Profitability" },
  { key: "paper",       label: "Paper Usage" },
  { key: "machines",    label: "Machines" },
  { key: "client-jobs", label: "Client Jobs" },
];

const JOB_STATUS_COLORS: Record<string, string> = {
  draft: "#868e96", enquiry: "#adb5bd", quotation: "#1971c2", design: "#7048e8",
  approval: "#f59f00", print: "#2f9e44", finishing: "#0c8599", qc: "#e67700",
  ready: "#2b8a3e", delivered: "#1864ab", cancelled: "#c92a2a",
};

const reportInputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 13, boxSizing: "border-box" };

function ReportSearchableSelect({ options, value, onChange, placeholder = "— select —" }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find(o => o.value === value)?.label ?? "";
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const filtered = query.trim() === "" ? options : options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input
        readOnly={!open}
        value={open ? query : selectedLabel}
        onChange={e => setQuery(e.target.value)}
        onClick={() => { setOpen(true); setQuery(""); }}
        onFocus={() => { setOpen(true); setQuery(""); }}
        placeholder={placeholder}
        style={{ ...reportInputStyle, cursor: "pointer" }}
      />
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 2000, background: "#fff", border: "1px solid #ddd", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,.12)", maxHeight: 220, overflowY: "auto", marginTop: 2 }}>
          {filtered.length === 0 && <div style={{ padding: "10px 14px", fontSize: 13, color: "#888" }}>No clients found</div>}
          {filtered.map(opt => (
            <div key={opt.value} onMouseDown={() => { onChange(opt.value); setOpen(false); setQuery(""); }}
              style={{ padding: "9px 14px", fontSize: 13, cursor: "pointer", background: opt.value === value ? "#e7ecff" : "transparent", color: opt.value === value ? "#3b5bdb" : "#333", fontWeight: opt.value === value ? 600 : 400 }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = "#f5f7ff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = opt.value === value ? "#e7ecff" : "transparent"; }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShimmerRow({ cols }: { cols: number }) {
  return (
    <>{Array.from({ length: 6 }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j} style={{ padding: "12px 16px" }}>
            <div style={{ height: 14, borderRadius: 4, background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.2s infinite" }} />
          </td>
        ))}
      </tr>
    ))}</>
  );
}

function ClientJobsReport() {
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: clients = [] } = useQuery<{ id: string; name: string; company_name: string }[]>({
    queryKey: ["clients-mini-report"],
    queryFn: () => api.get("/admin/clients", { params: { limit: 500 } }).then(r => r.data.data ?? []),
  });

  const clientOptions = useMemo(() => clients.map(c => ({ value: c.id, label: c.company_name ? `${c.company_name} (${c.name})` : c.name })), [clients]);

  // Build params without undefined so queryKey hash is deterministic
  const apiParams = useMemo(() => {
    const p: Record<string, string | number> = { clientId, page, limit: 20, sortBy, sortDir };
    if (status) p.status = status;
    if (from) p.from = from;
    if (to) p.to = to;
    if (search.trim()) p.search = search.trim();
    return p;
  }, [clientId, status, from, to, search, page, sortBy, sortDir]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-client-jobs", apiParams],
    queryFn: () => api.get("/admin/reports/client-jobs", { params: apiParams }).then(r => r.data),
    enabled: !!clientId,
  });

  const jobs: Record<string, unknown>[] = data?.data ?? [];
  const summary = data?.summary;
  const statusBreakdown: { status: string; count: number }[] = data?.statusBreakdown ?? [];
  const totalPages: number = data?.totalPages ?? 1;
  const total: number = data?.total ?? 0;

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <span style={{ color: "#d1d5db", marginLeft: 4 }}>↕</span>;
    return <span style={{ color: "#7c3aed", marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const thStyle: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "2px solid #e5e7eb", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { padding: "11px 14px", fontSize: 13, borderBottom: "1px solid #f3f4f6" };

  return (
    <div>
      {/* shimmer keyframes */}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Client selector + filters */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: "0 0 300px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>CLIENT *</span>
            <ReportSearchableSelect
              options={clientOptions}
              value={clientId}
              onChange={v => { setClientId(v); setPage(1); }}
              placeholder="— search & select client —"
            />
          </label>
          <label>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>STATUS</span>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, minWidth: 130 }}>
              <option value="">All Statuses</option>
              {["draft","enquiry","quotation","design","approval","print","finishing","qc","ready","delivered","cancelled"].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </label>
          <label>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>FROM</span>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13 }} />
          </label>
          <label>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>TO</span>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13 }} />
          </label>
          <label style={{ flex: "1 1 200px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>SEARCH</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search title, job type…" style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, width: "100%" }} />
          </label>
          {(status || from || to || search) && (
            <button onClick={() => { setStatus(""); setFrom(""); setTo(""); setSearch(""); setPage(1); }}
              style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, background: "#fff", fontSize: 13, cursor: "pointer", color: "#6b7280" }}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {!clientId && (
        <div style={{ background: "#f9fafb", borderRadius: 10, border: "1px dashed #d1d5db", padding: "48px 32px", textAlign: "center", color: "#9ca3af", fontSize: 15 }}>
          Select a client above to view their job cards
        </div>
      )}

      {clientId && summary && (
        <>
          {/* Summary stat cards */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard label="Total Jobs" value={String(summary.total_jobs ?? 0)} color="#7c3aed" />
            <StatCard label="Active Jobs" value={String(summary.active_jobs ?? 0)} color="#1971c2" />
            <StatCard label="Delivered" value={String(summary.delivered_jobs ?? 0)} color="#2b8a3e" />
            <StatCard label="Total Revenue" value={"₹" + Number(summary.total_revenue ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} color="#0c8599" />
            <StatCard label="Total Advance" value={"₹" + Number(summary.total_advance ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} color="#e67700" />
          </div>

          {/* Table */}
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Job Cards <span style={{ color: "#9ca3af", fontWeight: 400 }}>({total})</span></span>
              {jobs.length > 0 && (
                <button onClick={() => exportToCsv(`client-jobs-${new Date().toISOString().slice(0,10)}.csv`, jobs)}
                  style={{ padding: "6px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 12, fontWeight: 500 }}>⬇ Export</button>
              )}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={thStyle} onClick={() => toggleSort("job_number")}>#<SortIcon col="job_number" /></th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle} onClick={() => toggleSort("status")}>Status<SortIcon col="status" /></th>
                    <th style={thStyle} onClick={() => toggleSort("quantity")}>Qty<SortIcon col="quantity" /></th>
                    <th style={thStyle}>Machine</th>
                    <th style={thStyle} onClick={() => toggleSort("quoted_price")}>Quoted<SortIcon col="quoted_price" /></th>
                    <th style={thStyle}>Advance</th>
                    <th style={thStyle} onClick={() => toggleSort("due_date")}>Due Date<SortIcon col="due_date" /></th>
                    <th style={thStyle} onClick={() => toggleSort("created_at")}>Created<SortIcon col="created_at" /></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <ShimmerRow cols={9} />}
                  {!isLoading && jobs.map((j, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#7c3aed" }}>#{String(j.job_number)}</td>
                      <td style={{ ...tdStyle, maxWidth: 180 }}>{String(j.job_type || j.title || "—")}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: (JOB_STATUS_COLORS[String(j.status)] ?? "#868e96") + "22", color: JOB_STATUS_COLORS[String(j.status)] ?? "#868e96" }}>
                          {String(j.status ?? "—").toUpperCase()}
                        </span>
                      </td>
                      <td style={tdStyle}>{j.quantity != null ? String(j.quantity) + " pcs" : "—"}</td>
                      <td style={tdStyle}>{String(j.machine_name || "—")}</td>
                      <td style={tdStyle}>{j.quoted_price != null ? "₹" + Number(j.quoted_price).toLocaleString("en-IN") : "—"}</td>
                      <td style={tdStyle}>{j.advance_amount != null ? "₹" + Number(j.advance_amount).toLocaleString("en-IN") : "—"}</td>
                      <td style={tdStyle}>{j.due_date ? fmtDate(String(j.due_date)) : "—"}</td>
                      <td style={tdStyle}>{j.created_at ? fmtDate(String(j.created_at)) : "—"}</td>
                    </tr>
                  ))}
                  {!isLoading && jobs.length === 0 && (
                    <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: 32 }}>No jobs found for this client</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: page === 1 ? "default" : "pointer", background: "#fff", fontSize: 13, opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)} style={{ padding: "6px 12px", border: "1px solid " + (p === page ? "#7c3aed" : "#e5e7eb"), borderRadius: 7, cursor: "pointer", background: p === page ? "#7c3aed" : "#fff", color: p === page ? "#fff" : "#374151", fontSize: 13, fontWeight: p === page ? 700 : 400 }}>{p}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: page === totalPages ? "default" : "pointer", background: "#fff", fontSize: 13, opacity: page === totalPages ? 0.4 : 1 }}>Next →</button>
              <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 4 }}>Page {page} of {totalPages} · {total} jobs</span>
            </div>
          )}

          {/* Charts — below the list */}
          {statusBreakdown.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
              <div style={cardStyle}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 4 }}>Jobs by Status</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>Click a bar to filter the table by status</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={statusBreakdown.map(s => ({ name: s.status, Jobs: Number(s.count) }))}
                    margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                    onClick={d => { if (d?.activeLabel) { setStatus(st => st === d.activeLabel ? "" : d.activeLabel as string); setPage(1); } }}
                    style={{ cursor: "pointer" }}
                  >
                    <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="Jobs" radius={[4, 4, 0, 0]}>
                      {statusBreakdown.map((s, i) => (
                        <Cell key={i} fill={JOB_STATUS_COLORS[s.status] ?? "#7c3aed"} opacity={status && status !== s.status ? 0.35 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={cardStyle}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 4 }}>Status Distribution</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>Click a slice to filter by status</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown.map(s => ({ name: s.status, value: Number(s.count) }))}
                      dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, value }) => `${name}(${value})`} labelLine={false}
                      onClick={(entry) => { const name = String(entry?.name ?? ""); if (name) { setStatus(st => st === name ? "" : name); setPage(1); } }}
                      style={{ cursor: "pointer" }}
                    >
                      {statusBreakdown.map((s, i) => (
                        <Cell key={i} fill={JOB_STATUS_COLORS[s.status] ?? "#7c3aed"} opacity={status && status !== s.status ? 0.35 : 1} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── main ──────────────────────────────────────────────────
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dateParams = { ...(from && { from }), ...(to && { to }) };
  // createdFrom/createdTo map to the jobs endpoint's new created_at filter params
  const jobDateParams = { ...(from && { createdFrom: from }), ...(to && { createdTo: to }) };
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);

  // Drill-down helpers
  const jobCols = [
    { label: "Job #", key: "job_number", fmt: (v: unknown) => `#${v}` },
    { label: "Title", key: "job_type" },
    { label: "Client", key: "client_name" },
    { label: "Status", key: "status" },
    { label: "Qty", key: "quantity" },
    { label: "Quoted", key: "quoted_price", fmt: (v: unknown) => v ? fmt(v as number) : "—" },
    { label: "Due Date", key: "due_date", fmt: (v: unknown) => v ? fmtDate(v as string) : "—" },
  ];

  function drillJobs(title: string, params: Record<string, string>) {
    setDrillDown({
      title,
      queryKey: ["drill-jobs", params],
      queryFn: () => api.get("/admin/jobs", { params: { ...params, limit: "200" } }).then(r => r.data.data ?? []),
      columns: jobCols,
    });
  }

  function drillInvoices(title: string, params: Record<string, string>) {
    setDrillDown({
      title,
      queryKey: ["drill-invoices", params],
      queryFn: () => api.get("/admin/billing/invoices", { params: { ...params, limit: "200" } }).then(r => r.data.data ?? []),
      columns: [
        { label: "Invoice #", key: "invoice_number", fmt: (v: unknown) => `#${v}` },
        { label: "Client", key: "client_name" },
        { label: "Total", key: "total", fmt: (v: unknown) => fmt(v as number) },
        { label: "Paid", key: "amount_paid", fmt: (v: unknown) => fmt(v as number) },
        { label: "Balance", key: "balance_due", fmt: (v: unknown) => fmt(v as number) },
        { label: "Status", key: "status" },
        { label: "Due Date", key: "due_date", fmt: (v: unknown) => v ? fmtDate(v as string) : "—" },
      ],
    });
  }

  // queries
  const { data: profitability } = useQuery({ queryKey: ["report-profitability", dateParams], queryFn: () => api.get("/admin/reports/job-profitability", { params: dateParams }).then(r => r.data) });
  const { data: machines } = useQuery({ queryKey: ["report-machines", dateParams], queryFn: () => api.get("/admin/reports/machine-utilization", { params: dateParams }).then(r => r.data) });
  const { data: outstanding } = useQuery({ queryKey: ["report-outstanding"], queryFn: () => api.get("/admin/reports/outstanding-payments").then(r => r.data) });
  const { data: clientRevenue } = useQuery({ queryKey: ["report-client-revenue", dateParams], queryFn: () => api.get("/admin/reports/revenue-by-client", { params: dateParams }).then(r => r.data) });
  const { data: jobsByStatus } = useQuery({ queryKey: ["report-jobs-status", dateParams], queryFn: () => api.get("/admin/reports/jobs-by-status", { params: dateParams }).then(r => r.data) });
  const { data: paperConsumption } = useQuery({ queryKey: ["report-paper", dateParams], queryFn: () => api.get("/admin/reports/paper-consumption", { params: dateParams }).then(r => r.data) });
  const { data: monthlyRevenue } = useQuery({ queryKey: ["report-monthly", dateParams], queryFn: () => api.get("/admin/reports/monthly-revenue", { params: { months: "12", ...dateParams } }).then(r => r.data) });

  // exports
  function exportCsv(filename: string, rows: Record<string, unknown>[]) {
    exportToCsv(`${filename}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div>
      {drillDown && <DrillDownModal config={drillDown} onClose={() => setDrillDown(null)} />}
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Reports</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="no-print">
          <PrintListButton label="Print Report" />
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print" style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 0, borderBottom: "2px solid #e5e7eb" }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "9px 16px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: "transparent", borderBottom: activeTab === t.key ? "2px solid #7c3aed" : "2px solid transparent",
              color: activeTab === t.key ? "#7c3aed" : "#6b7280", marginBottom: -2, borderRadius: "4px 4px 0 0",
              transition: "color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Global date range filter — hidden on Client Jobs tab which has its own */}
      <div className="no-print" style={{ background: "#fff", borderRadius: "0 0 10px 10px", border: "1px solid #e5e7eb", borderTop: "none", padding: "12px 20px", marginBottom: 24, display: activeTab === "client-jobs" ? "none" : "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>Date Range</span>
        <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
          From <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: "5px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
          To <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: "5px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        </label>
        {(from || to) && (
          <button onClick={() => { setFrom(""); setTo(""); }} style={{ padding: "5px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 12, color: "#6b7280" }}>
            Clear
          </button>
        )}
        {from || to ? <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 500 }}>Filtered: {from || "…"} → {to || "…"}</span> : <span style={{ fontSize: 12, color: "#9ca3af" }}>Showing all time</span>}
      </div>

      {/* 1. Monthly Revenue Trend */}
      {activeTab === "monthly" && monthlyRevenue && monthlyRevenue.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Monthly Revenue Trend",
            <button className="no-print" onClick={() => exportCsv("monthly-revenue", monthlyRevenue)} style={exportBtnStyle}>⬇ Export</button>
          )}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard label="Last 12 Months Revenue" value={fmt(monthlyRevenue.reduce((s: number, r: MonthRow) => s + Number(r.revenue), 0))} color="#7c3aed" />
            <StatCard label="Last 12 Months Collected" value={fmt(monthlyRevenue.reduce((s: number, r: MonthRow) => s + Number(r.collected), 0))} color="#2b8a3e" />
            <StatCard label="Total Invoices" value={String(monthlyRevenue.reduce((s: number, r: MonthRow) => s + Number(r.invoice_count), 0))} color="#1971c2" />
          </div>
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Revenue vs Collected per Month</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyRevenue.map((r: MonthRow) => ({ month: r.month, Revenue: Number(r.revenue), Collected: Number(r.collected) }))} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                onClick={(d) => { if (d?.activeLabel) drillInvoices(`Invoices — ${d.activeLabel}`, { from: d.activeLabel + "-01", to: d.activeLabel + "-31" }); }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" tick={axisTickStyle} />
                <YAxis tickFormatter={moneyFmt} tick={axisTickStyle} width={90} />
                <Tooltip formatter={(v) => moneyFmt(v as number)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4, cursor: "pointer" }} />
                <Line type="monotone" dataKey="Collected" stroke="#2b8a3e" strokeWidth={2} dot={{ r: 4, cursor: "pointer" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 2. Jobs by Status (Pipeline) */}
      {activeTab === "pipeline" && jobsByStatus && jobsByStatus.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Job Pipeline by Status",
            <button className="no-print" onClick={() => exportCsv("jobs-by-status", jobsByStatus)} style={exportBtnStyle}>⬇ Export</button>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
            <div style={cardStyle}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Jobs per Status</div>
              <ResponsiveContainer width="100%" height={Math.max(200, jobsByStatus.length * 44)}>
                <BarChart data={jobsByStatus.map((r: StatusRow) => ({ name: r.status, Jobs: Number(r.count) }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  onClick={(d) => { if (d?.activeLabel) drillJobs(`Jobs — ${d.activeLabel}`, { status: String(d.activeLabel), ...jobDateParams }); }}>
                  <CartesianGrid {...gridStyle} horizontal={false} />
                  <XAxis type="number" tick={axisTickStyle} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={axisTickStyle} width={80} />
                  <Tooltip formatter={(v) => countFmt(v as number)} />
                  <Bar dataKey="Jobs" radius={[0, 3, 3, 0]} cursor="pointer">
                    {jobsByStatus.map((r: StatusRow, i: number) => (
                      <Cell key={i} fill={STATUS_COLOR[r.status] ?? "#868e96"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              {jobsByStatus.map((r: StatusRow) => (
                <div key={r.status} onClick={() => drillJobs(`Jobs — ${r.status}`, { status: r.status, ...jobDateParams })}
                  style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 8, borderLeft: `4px solid ${STATUS_COLOR[r.status] ?? "#868e96"}`, cursor: "pointer", transition: "box-shadow 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{r.status}</span>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>{r.count}</span>
                  </div>
                  {Number(r.total_value) > 0 && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{fmt(r.total_value)}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Revenue by Client */}
      {activeTab === "clients" && clientRevenue && clientRevenue.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Revenue by Client",
            <button className="no-print" onClick={() => exportCsv("revenue-by-client", clientRevenue)} style={exportBtnStyle}>⬇ Export</button>
          )}
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Top Clients by Revenue</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={clientRevenue.slice(0, 10).map((r: ClientRevRow) => ({ name: r.client_name?.slice(0, 14) ?? "—", clientId: r.client_id, Billed: Number(r.total_billed), Paid: Number(r.total_paid) }))} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}
                onClick={(d) => { const r = clientRevenue.find((c: ClientRevRow) => c.client_name?.slice(0,14) === d?.activeLabel); if (r) drillInvoices(`Invoices — ${r.client_name}`, { clientId: r.client_id, ...dateParams }); }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="name" tick={{ ...axisTickStyle, angle: -30, textAnchor: "end" }} interval={0} />
                <YAxis tickFormatter={moneyFmt} tick={axisTickStyle} width={90} />
                <Tooltip formatter={(v) => moneyFmt(v as number)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Billed" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Paid" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {["Client", "Invoices", "Total Billed", "Collected", "Outstanding"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#555" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {clientRevenue.map((r: ClientRevRow) => (
                <tr key={r.client_id} onClick={() => drillInvoices(`Invoices — ${r.client_name}`, { clientId: r.client_id, ...dateParams })} style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#faf5ff")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.client_name ?? "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{r.total_invoices}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#7c3aed" }}>{fmt(r.total_billed)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#2b8a3e", fontWeight: 600 }}>{fmt(r.total_paid)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: Number(r.total_outstanding) > 0 ? "#c92a2a" : "#2b8a3e", fontWeight: 600 }}>{fmt(r.total_outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Outstanding Payments */}
      {activeTab === "outstanding" && outstanding && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Outstanding Payments",
            <button className="no-print" onClick={() => exportCsv("outstanding-payments", outstanding.invoices)} style={exportBtnStyle}>⬇ Export</button>
          )}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard label="Total Outstanding" value={fmt(outstanding.summary.total_outstanding)} color="#c92a2a" />
            <StatCard label="Overdue Invoices" value={String(outstanding.invoices.filter((i: OutstandingInvoice) => i.urgency === "overdue").length)} color="#f59f00" />
            <StatCard label="Total Invoices" value={String(outstanding.summary.count)} color="#1971c2" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, alignItems: "start" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {["Client", "Invoice #", "Balance Due", "Due Date", "Urgency"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#555" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {outstanding.invoices.map((i: OutstandingInvoice) => (
                  <tr key={i.id} onClick={() => drillInvoices(`Invoices — ${i.client_name}`, { clientId: (i as unknown as { client_id: string }).client_id })} style={{ borderBottom: "1px solid #f0f0f0", background: i.urgency === "overdue" ? "#fff5f5" : "#fff", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                    <td style={{ padding: "12px 16px", fontWeight: 500 }}>{i.client_name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>#{i.invoice_number}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#c92a2a" }}>{fmt(i.balance_due)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{i.due_date || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: i.urgency === "overdue" ? "#ffe3e3" : i.urgency === "due_today" ? "#fff3bf" : "#e8f5e9", color: i.urgency === "overdue" ? "#c92a2a" : i.urgency === "due_today" ? "#e67700" : "#2b8a3e" }}>
                        {i.urgency.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(() => {
              const groups: Record<string, number> = {};
              outstanding.invoices.forEach((i: OutstandingInvoice) => {
                const key = i.urgency === "due_today" ? "overdue" : i.urgency;
                groups[key] = (groups[key] || 0) + Number(i.balance_due);
              });
              const pieData = Object.entries(groups).map(([key, value]) => ({ name: PIE_OUTSTANDING_LABELS[key] ?? key, value, color: PIE_OUTSTANDING_COLORS[key] ?? "#868e96" }));
              return pieData.length > 0 ? (
                <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 8 }}>By Status</div>
                  <PieChart width={180} height={180}>
                    <Pie data={pieData} cx={90} cy={90} innerRadius={44} outerRadius={78} dataKey="value" paddingAngle={3}
                      style={{ cursor: "pointer" }}
                      onClick={(entry) => { drillInvoices(`Outstanding — ${String(entry?.name ?? "")}`, {}); }}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => moneyFmt(v as number)} />
                  </PieChart>
                  <div style={{ marginTop: 8, width: "100%" }}>
                    {pieData.map((e, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", marginBottom: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{e.name}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* 5. Job Profitability */}
      {activeTab === "profitability" && profitability && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Job Profitability",
            <button className="no-print" onClick={() => exportCsv("job-profitability", profitability.jobs)} style={exportBtnStyle}>⬇ Export</button>
          )}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard label="Revenue" value={fmt(profitability.summary.revenue)} color="#1971c2" />
            <StatCard label="Cost" value={fmt(profitability.summary.cost)} color="#868e96" />
            <StatCard label="Margin" value={fmt(profitability.summary.margin)} color="#2b8a3e" />
          </div>
          {profitability.jobs.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Quoted vs Actual Cost per Job</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={profitability.jobs.map((j: ProfitabilityJob) => ({ name: j.title ? j.title.slice(0, 15) : `#${j.job_number}`, jobId: j.id, jobNumber: j.job_number, Quoted: Number(j.quoted_price) || 0, "Actual Cost": Number(j.computed_cost) || 0 }))} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  onClick={(d) => { const j = profitability.jobs.find((x: ProfitabilityJob) => (x.title ? x.title.slice(0,15) : `#${x.job_number}`) === d?.activeLabel); if (j) drillJobs(`Job #${j.job_number} — ${j.title || ""}`, { search: String(j.job_number) }); }}
                  style={{ cursor: "pointer" }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="name" tick={axisTickStyle} />
                  <YAxis tickFormatter={moneyFmt} tick={axisTickStyle} width={80} />
                  <Tooltip formatter={(v) => moneyFmt(v as number)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Quoted" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual Cost" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {["Job #", "Title", "Client", "Quoted", "Actual Cost", "Margin", "Margin %"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#555" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {profitability.jobs.map((j: ProfitabilityJob) => (
                <tr key={j.id} onClick={() => drillJobs(`Job #${j.job_number} — ${j.title}`, { search: String(j.job_number) })} style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#faf5ff")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#888" }}>#{j.job_number}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>{j.title}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{j.client_name || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{j.quoted_price ? fmt(j.quoted_price) : "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{j.computed_cost ? fmt(j.computed_cost) : "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: j.actual_margin > 0 ? "#2b8a3e" : "#c92a2a" }}>{j.actual_margin != null ? fmt(j.actual_margin) : "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{j.margin_percent != null ? `${j.margin_percent}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Paper Consumption */}
      {activeTab === "paper" && paperConsumption && paperConsumption.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Paper Consumption",
            <button className="no-print" onClick={() => exportCsv("paper-consumption", paperConsumption)} style={exportBtnStyle}>⬇ Export</button>
          )}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard label="Total Sheets Used" value={String(paperConsumption.reduce((s: number, r: PaperRow) => s + Number(r.total_sheets), 0).toLocaleString("en-IN"))} color="#0c8599" />
            <StatCard label="Paper Types Used" value={String(paperConsumption.length)} color="#7048e8" />
          </div>
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Sheets Used per Paper Type</div>
            <ResponsiveContainer width="100%" height={Math.max(180, paperConsumption.length * 44)}>
              <BarChart data={paperConsumption.map((r: PaperRow) => ({ name: `${r.paper_name} ${r.gsm ?? ""}gsm`, Sheets: Number(r.total_sheets) }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                onClick={(d) => { const p = paperConsumption.find((x: PaperRow) => `${x.paper_name} ${x.gsm ?? ""}gsm` === d?.activeLabel); if (p) setDrillDown({ title: `Transactions — ${p.paper_name}`, queryKey: ["drill-paper-txn", p.paper_stock_id], queryFn: () => api.get("/admin/inventory/transactions", { params: { paperStockId: p.paper_stock_id, limit: "200" } }).then(r => r.data.data ?? []), columns: [{ label: "Date", key: "transacted_at", fmt: (v) => fmtDate(v as string) }, { label: "Type", key: "type" }, { label: "Qty", key: "quantity" }, { label: "Notes", key: "notes" }] }); }}>
                <CartesianGrid {...gridStyle} horizontal={false} />
                <XAxis type="number" tick={axisTickStyle} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={axisTickStyle} width={140} />
                <Tooltip formatter={(v) => countFmt(v as number)} />
                <Bar dataKey="Sheets" fill="#0c8599" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {["Paper", "GSM", "Size", "Jobs Used In", "Total Sheets"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#555" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {paperConsumption.map((r: PaperRow) => (
                <tr key={r.paper_stock_id} onClick={() => setDrillDown({ title: `Transactions — ${r.paper_name}`, queryKey: ["drill-paper-txn", r.paper_stock_id], queryFn: () => api.get("/admin/inventory/transactions", { params: { paperStockId: r.paper_stock_id, limit: "200" } }).then(res => res.data.data ?? []), columns: [{ label: "Date", key: "transacted_at", fmt: (v) => fmtDate(v as string) }, { label: "Type", key: "type" }, { label: "Qty", key: "quantity" }, { label: "Notes", key: "notes" }] })} style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0fdfd")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.paper_name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{r.gsm ? `${r.gsm} GSM` : "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{r.size || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{r.usage_count}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0c8599" }}>{Number(r.total_sheets).toLocaleString("en-IN")} {r.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. Machine Utilization */}
      {activeTab === "machines" && machines && machines.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Machine Utilization")}
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Jobs per Machine</div>
            <ResponsiveContainer width="100%" height={Math.max(180, machines.length * 48)}>
              <BarChart data={machines.map((m: MachineRow) => ({ name: m.machine_name, Jobs: Number(m.total_jobs) }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                onClick={(d) => { const m = machines.find((x: MachineRow) => x.machine_name === d?.activeLabel); if (m) drillJobs(`Jobs on ${m.machine_name}`, { machineId: m.machine_id, ...jobDateParams }); }}>
                <CartesianGrid {...gridStyle} horizontal={false} />
                <XAxis type="number" tick={axisTickStyle} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={axisTickStyle} width={110} />
                <Tooltip formatter={(v) => countFmt(v as number)} />
                <Bar dataKey="Jobs" fill="#7c3aed" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
            {machines.map((m: MachineRow) => (
              <div key={m.machine_id} onClick={() => drillJobs(`Jobs on ${m.machine_name}`, { machineId: m.machine_id, ...jobDateParams })}
                style={{ background: "#fff", padding: 18, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #7c3aed", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(124,58,237,0.15)")} onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.06)")}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{m.machine_name}</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>Total: <strong>{m.total_jobs}</strong></div>
                <div style={{ fontSize: 13, color: "#2b8a3e", marginBottom: 4 }}>Done: <strong>{m.completed_jobs}</strong></div>
                <div style={{ fontSize: 13, color: "#1971c2" }}>Active: <strong>{m.active_jobs}</strong></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. Client Jobs */}
      {activeTab === "client-jobs" && <ClientJobsReport />}

    </div>
  );
}
