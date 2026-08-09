import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { exportToCsv } from "../lib/exportCsv.ts";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

function fmt(n: number) { return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

const exportBtnStyle: React.CSSProperties = { padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 };

const axisTickStyle = { fontSize: 11, fill: "#6b7280" };
const gridStyle = { stroke: "#f3f4f6", strokeDasharray: "3 3" };

const moneyFormatter = (value: number | string | undefined | null) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN")}`;
const countFormatter = (value: number | string | undefined | null) => String(value ?? 0);

const PIE_COLORS: Record<string, string> = {
  issued: "#1971c2",
  partially_paid: "#f59e0b",
  overdue: "#ef4444",
};

const PIE_LABELS: Record<string, string> = {
  issued: "Issued",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
};

type OutstandingInvoice = {
  id: string;
  client_name: string;
  invoice_number: number;
  balance_due: number;
  due_date: string;
  urgency: string;
};

type ProfitabilityJob = {
  id: string;
  job_number: number;
  title: string;
  client_name: string;
  quoted_price: number;
  actual_cost: number; computed_cost: number;
  actual_margin: number;
  margin_percent: number;
};

type MachineRow = {
  machine_id: string;
  machine_name: string;
  total_jobs: number;
  completed_jobs: number;
  active_jobs: number;
  machine_status: string;
};

export default function ReportsPage() {
  const [exportingOutstanding, setExportingOutstanding] = useState(false);
  const [exportingProfitability, setExportingProfitability] = useState(false);

  const { data: profitability } = useQuery({
    queryKey: ["report-profitability"],
    queryFn: () => api.get("/admin/reports/job-profitability").then(r => r.data),
  });
  const { data: machines } = useQuery({
    queryKey: ["report-machines"],
    queryFn: () => api.get("/admin/reports/machine-utilization").then(r => r.data),
  });
  const { data: outstanding } = useQuery({
    queryKey: ["report-outstanding"],
    queryFn: () => api.get("/admin/reports/outstanding-payments").then(r => r.data),
  });

  function handleExportOutstanding() {
    if (!outstanding?.invoices?.length) return;
    setExportingOutstanding(true);
    const date = new Date().toISOString().slice(0, 10);
    const rows = outstanding.invoices.map((i: OutstandingInvoice) => ({
      client_name: i.client_name, invoice_number: i.invoice_number,
      balance_due: i.balance_due, due_date: i.due_date, urgency: i.urgency,
    }));
    exportToCsv(`outstanding-payments-${date}.csv`, rows);
    setExportingOutstanding(false);
  }

  function handleExportProfitability() {
    if (!profitability?.jobs?.length) return;
    setExportingProfitability(true);
    const date = new Date().toISOString().slice(0, 10);
    const rows = profitability.jobs.map((j: ProfitabilityJob) => ({
      job_number: j.job_number, title: j.title, client_name: j.client_name,
      quoted_price: j.quoted_price, actual_cost: j.computed_cost,
      actual_margin: j.actual_margin, margin_percent: j.margin_percent,
    }));
    exportToCsv(`job-profitability-${date}.csv`, rows);
    setExportingProfitability(false);
  }

  // --- Derived chart data ---

  // Job Profitability bar chart data
  const profitabilityChartData = (profitability?.jobs ?? []).map((j: ProfitabilityJob) => ({
    name: j.title ? j.title.slice(0, 15) : `#${j.job_number}`,
    Quoted: Number(j.quoted_price) || 0,
    "Actual Cost": Number(j.computed_cost) || 0,
  }));

  // Machine Utilization horizontal bar chart data
  const machineChartData = (machines ?? []).map((m: MachineRow) => ({
    name: m.machine_name,
    Jobs: Number(m.total_jobs) || 0,
  }));
  const machineChartHeight = Math.max(180, (machines?.length ?? 0) * 48);

  // Outstanding Payments pie chart data
  const outstandingPieData = (() => {
    if (!outstanding?.invoices?.length) return [];
    const groups: Record<string, number> = {};
    outstanding.invoices.forEach((i: OutstandingInvoice) => {
      const key = i.urgency === "overdue" ? "overdue"
        : i.urgency === "due_today" ? "overdue"
        : "issued";
      groups[key] = (groups[key] || 0) + Number(i.balance_due);
    });
    return Object.entries(groups).map(([key, value]) => ({
      name: PIE_LABELS[key] ?? key,
      value,
      color: PIE_COLORS[key] ?? "#868e96",
    }));
  })();

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    padding: 20,
    marginBottom: 20,
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Reports</h1>

      {/* Outstanding payments summary */}
      {outstanding && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Outstanding Payments</h2>
            <button onClick={handleExportOutstanding} disabled={exportingOutstanding} style={exportBtnStyle}>{exportingOutstanding ? "Exporting…" : "⬇ Export"}</button>
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #c92a2a", minWidth: 160 }}>
              <div style={{ fontSize: 13, color: "#888" }}>Total Outstanding</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#c92a2a" }}>{fmt(outstanding.summary.total_outstanding)}</div>
            </div>
            <div style={{ background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #f59f00", minWidth: 160 }}>
              <div style={{ fontSize: 13, color: "#888" }}>Overdue Invoices</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f59f00" }}>{outstanding.invoices.filter((i: OutstandingInvoice) => i.urgency === "overdue").length}</div>
            </div>
          </div>

          {/* Outstanding Payments — Pie chart + Table side by side */}
          <div style={{ display: "grid", gridTemplateColumns: outstandingPieData.length ? "1fr 240px" : "1fr", gap: 24, alignItems: "start" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 8 }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {["Client", "Invoice #", "Balance Due", "Due Date", "Urgency"].map(h => <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#555" }}>{h}</th>)}
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

            {outstandingPieData.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 8 }}>By Status</div>
                <PieChart width={200} height={200}>
                  <Pie
                    data={outstandingPieData}
                    cx={100}
                    cy={100}
                    innerRadius={50}
                    outerRadius={85}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {outstandingPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => moneyFormatter(value as number)} />
                </PieChart>
                <div style={{ marginTop: 8, width: "100%" }}>
                  {outstandingPieData.map((entry, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", marginBottom: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{entry.name}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job profitability */}
      {profitability && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Job Profitability</h2>
            <button onClick={handleExportProfitability} disabled={exportingProfitability} style={exportBtnStyle}>{exportingProfitability ? "Exporting…" : "⬇ Export"}</button>
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Revenue", value: fmt(profitability.summary.revenue), color: "#1971c2" },
              { label: "Cost", value: fmt(profitability.summary.cost), color: "#868e96" },
              { label: "Margin", value: fmt(profitability.summary.margin), color: "#2b8a3e" },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: `3px solid ${s.color}`, minWidth: 160 }}>
                <div style={{ fontSize: 13, color: "#888" }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Job Profitability Bar Chart */}
          {profitabilityChartData.length > 0 && (
            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Quoted vs Actual Cost per Job</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={profitabilityChartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="name" tick={axisTickStyle} />
                  <YAxis tickFormatter={moneyFormatter} tick={axisTickStyle} width={80} />
                  <Tooltip formatter={(value) => moneyFormatter(value as number)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Quoted" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual Cost" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {["Job #", "Title", "Client", "Quoted", "Actual Cost", "Margin", "Margin %"].map(h => <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#555" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {profitability.jobs.map((j: ProfitabilityJob) => (
                <tr key={j.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#888" }}>#{j.job_number}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>{j.title}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{j.client_name || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{j.quoted_price ? fmt(j.quoted_price) : "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{j.computed_cost ? fmt(j.computed_cost) : "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: j.actual_margin > 0 ? "#2b8a3e" : "#c92a2a", fontWeight: 600 }}>{j.actual_margin != null ? fmt(j.actual_margin) : "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{j.margin_percent != null ? `${j.margin_percent}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Machine utilization */}
      {machines && machines.length > 0 && (
        <div>
          <h2 style={{ marginBottom: 16, fontSize: 18 }}>Machine Utilization</h2>

          {/* Machine Horizontal Bar Chart */}
          <div style={{ ...cardStyle }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Jobs per Machine</div>
            <ResponsiveContainer width="100%" height={machineChartHeight}>
              <BarChart data={machineChartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid {...gridStyle} horizontal={false} />
                <XAxis type="number" tick={axisTickStyle} tickFormatter={countFormatter} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={axisTickStyle} width={110} />
                <Tooltip formatter={(value) => countFormatter(value as number)} />
                <Bar dataKey="Jobs" fill="#7c3aed" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            {machines.map((m: MachineRow) => (
              <div key={m.machine_id} style={{ background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{m.machine_name}</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>Total: <strong>{m.total_jobs}</strong></div>
                <div style={{ fontSize: 13, color: "#2b8a3e", marginBottom: 4 }}>Done: <strong>{m.completed_jobs}</strong></div>
                <div style={{ fontSize: 13, color: "#1971c2" }}>Active: <strong>{m.active_jobs}</strong></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
