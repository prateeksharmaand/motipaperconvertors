import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { exportToCsv } from "../lib/exportCsv.ts";
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
type StaffRow = { operator_id: string; operator_name: string; total_jobs: number; completed_jobs: number; };
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

// ── main ──────────────────────────────────────────────────
export default function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dateParams = { ...(from && { from }), ...(to && { to }) };

  // queries
  const { data: profitability } = useQuery({ queryKey: ["report-profitability", dateParams], queryFn: () => api.get("/admin/reports/job-profitability", { params: dateParams }).then(r => r.data) });
  const { data: machines } = useQuery({ queryKey: ["report-machines", dateParams], queryFn: () => api.get("/admin/reports/machine-utilization", { params: dateParams }).then(r => r.data) });
  const { data: outstanding } = useQuery({ queryKey: ["report-outstanding"], queryFn: () => api.get("/admin/reports/outstanding-payments").then(r => r.data) });
  const { data: staff } = useQuery({ queryKey: ["report-staff", dateParams], queryFn: () => api.get("/admin/reports/staff-output", { params: dateParams }).then(r => r.data) });
  const { data: clientRevenue } = useQuery({ queryKey: ["report-client-revenue", dateParams], queryFn: () => api.get("/admin/reports/revenue-by-client", { params: dateParams }).then(r => r.data) });
  const { data: jobsByStatus } = useQuery({ queryKey: ["report-jobs-status", dateParams], queryFn: () => api.get("/admin/reports/jobs-by-status", { params: dateParams }).then(r => r.data) });
  const { data: paperConsumption } = useQuery({ queryKey: ["report-paper", dateParams], queryFn: () => api.get("/admin/reports/paper-consumption", { params: dateParams }).then(r => r.data) });
  const { data: monthlyRevenue } = useQuery({ queryKey: ["report-monthly"], queryFn: () => api.get("/admin/reports/monthly-revenue", { params: { months: "12" } }).then(r => r.data) });

  // exports
  function exportCsv(filename: string, rows: Record<string, unknown>[]) {
    exportToCsv(`${filename}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Reports</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="no-print">
          <PrintListButton label="Print Report" />
        </div>
      </div>

      {/* Global date range filter */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 20px", marginBottom: 24, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
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
      {monthlyRevenue && monthlyRevenue.length > 0 && (
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
              <LineChart data={monthlyRevenue.map((r: MonthRow) => ({ month: r.month, Revenue: Number(r.revenue), Collected: Number(r.collected) }))} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" tick={axisTickStyle} />
                <YAxis tickFormatter={moneyFmt} tick={axisTickStyle} width={90} />
                <Tooltip formatter={(v) => moneyFmt(v as number)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Collected" stroke="#2b8a3e" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 2. Jobs by Status (Pipeline) */}
      {jobsByStatus && jobsByStatus.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Job Pipeline by Status",
            <button className="no-print" onClick={() => exportCsv("jobs-by-status", jobsByStatus)} style={exportBtnStyle}>⬇ Export</button>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
            <div style={cardStyle}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Jobs per Status</div>
              <ResponsiveContainer width="100%" height={Math.max(200, jobsByStatus.length * 44)}>
                <BarChart data={jobsByStatus.map((r: StatusRow) => ({ name: r.status, Jobs: Number(r.count) }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                  <CartesianGrid {...gridStyle} horizontal={false} />
                  <XAxis type="number" tick={axisTickStyle} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={axisTickStyle} width={80} />
                  <Tooltip formatter={(v) => countFmt(v as number)} />
                  <Bar dataKey="Jobs" radius={[0, 3, 3, 0]}>
                    {jobsByStatus.map((r: StatusRow, i: number) => (
                      <Cell key={i} fill={STATUS_COLOR[r.status] ?? "#868e96"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              {jobsByStatus.map((r: StatusRow) => (
                <div key={r.status} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 8, borderLeft: `4px solid ${STATUS_COLOR[r.status] ?? "#868e96"}` }}>
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
      {clientRevenue && clientRevenue.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Revenue by Client",
            <button className="no-print" onClick={() => exportCsv("revenue-by-client", clientRevenue)} style={exportBtnStyle}>⬇ Export</button>
          )}
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Top Clients by Revenue</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={clientRevenue.slice(0, 10).map((r: ClientRevRow) => ({ name: r.client_name?.slice(0, 14) ?? "—", Billed: Number(r.total_billed), Paid: Number(r.total_paid) }))} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
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
                <tr key={r.client_id} style={{ borderBottom: "1px solid #f0f0f0" }}>
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
      {outstanding && (
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
                  <tr key={i.id} style={{ borderBottom: "1px solid #f0f0f0", background: i.urgency === "overdue" ? "#fff5f5" : "#fff" }}>
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
                    <Pie data={pieData} cx={90} cy={90} innerRadius={44} outerRadius={78} dataKey="value" paddingAngle={3}>
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
      {profitability && (
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
                <BarChart data={profitability.jobs.map((j: ProfitabilityJob) => ({ name: j.title ? j.title.slice(0, 15) : `#${j.job_number}`, Quoted: Number(j.quoted_price) || 0, "Actual Cost": Number(j.computed_cost) || 0 }))} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
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
                <tr key={j.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
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
      {paperConsumption && paperConsumption.length > 0 && (
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
              <BarChart data={paperConsumption.map((r: PaperRow) => ({ name: `${r.paper_name} ${r.gsm ?? ""}gsm`, Sheets: Number(r.total_sheets) }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
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
                <tr key={r.paper_stock_id} style={{ borderBottom: "1px solid #f0f0f0" }}>
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
      {machines && machines.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Machine Utilization")}
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Jobs per Machine</div>
            <ResponsiveContainer width="100%" height={Math.max(180, machines.length * 48)}>
              <BarChart data={machines.map((m: MachineRow) => ({ name: m.machine_name, Jobs: Number(m.total_jobs) }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
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
              <div key={m.machine_id} style={{ background: "#fff", padding: 18, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #7c3aed" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{m.machine_name}</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>Total: <strong>{m.total_jobs}</strong></div>
                <div style={{ fontSize: 13, color: "#2b8a3e", marginBottom: 4 }}>Done: <strong>{m.completed_jobs}</strong></div>
                <div style={{ fontSize: 13, color: "#1971c2" }}>Active: <strong>{m.active_jobs}</strong></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Staff Output */}
      {staff && staff.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {sectionHead("Staff Output",
            <button className="no-print" onClick={() => exportCsv("staff-output", staff)} style={exportBtnStyle}>⬇ Export</button>
          )}
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Jobs per Operator</div>
            <ResponsiveContainer width="100%" height={Math.max(180, staff.length * 44)}>
              <BarChart data={staff.map((r: StaffRow) => ({ name: r.operator_name, Total: Number(r.total_jobs), Completed: Number(r.completed_jobs) }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid {...gridStyle} horizontal={false} />
                <XAxis type="number" tick={axisTickStyle} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={axisTickStyle} width={110} />
                <Tooltip formatter={(v) => countFmt(v as number)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Total" fill="#7c3aed" radius={[0, 3, 3, 0]} />
                <Bar dataKey="Completed" fill="#10b981" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
            {staff.map((r: StaffRow) => (
              <div key={r.operator_id} style={{ background: "#fff", padding: 18, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #10b981" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{r.operator_name}</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>Total Jobs: <strong>{r.total_jobs}</strong></div>
                <div style={{ fontSize: 13, color: "#2b8a3e" }}>Completed: <strong>{r.completed_jobs}</strong></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
