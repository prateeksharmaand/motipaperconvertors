import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";

function fmt(n: number) { return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

export default function ReportsPage() {
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

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Reports</h1>

      {/* Outstanding payments summary */}
      {outstanding && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16, fontSize: 18 }}>Outstanding Payments</h2>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #c92a2a", minWidth: 160 }}>
              <div style={{ fontSize: 13, color: "#888" }}>Total Outstanding</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#c92a2a" }}>{fmt(outstanding.summary.total_outstanding)}</div>
            </div>
            <div style={{ background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #f59f00", minWidth: 160 }}>
              <div style={{ fontSize: 13, color: "#888" }}>Overdue Invoices</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f59f00" }}>{outstanding.invoices.filter((i: { urgency: string }) => i.urgency === "overdue").length}</div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 8 }}>
            <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {["Client", "Invoice #", "Balance Due", "Due Date", "Urgency"].map(h => <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#555" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {outstanding.invoices.map((i: { id: string; client_name: string; invoice_number: number; balance_due: number; due_date: string; urgency: string }) => (
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
        </div>
      )}

      {/* Job profitability */}
      {profitability && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16, fontSize: 18 }}>Job Profitability</h2>
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
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {["Job #", "Title", "Client", "Quoted", "Actual Cost", "Margin", "Margin %"].map(h => <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#555" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {profitability.jobs.map((j: { id: string; job_number: number; title: string; client_name: string; quoted_price: number; actual_cost: number; actual_margin: number; margin_percent: number }) => (
                <tr key={j.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#888" }}>#{j.job_number}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>{j.title}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{j.client_name || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{j.quoted_price ? fmt(j.quoted_price) : "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{j.actual_cost ? fmt(j.actual_cost) : "—"}</td>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            {machines.map((m: { machine_id: string; machine_name: string; total_jobs: number; completed_jobs: number; active_jobs: number; machine_status: string }) => (
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
