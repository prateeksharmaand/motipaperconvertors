import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth.ts";
import { api } from "../lib/api.ts";
import * as theme from "../theme.ts";
import { statusLabel } from "../theme.ts";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  sub_admin: "Sub Admin",
  staff: "Staff",
  operator: "Operator",
};

const STATUS_COLOR: Record<string, "green" | "red" | "amber" | "blue" | "purple" | "gray"> = {
  enquiry: "gray",
  quotation: "blue",
  design: "purple",
  approval: "amber",
  print: "green",
  finishing: "blue",
  qc: "amber",
  ready: "green",
  delivered: "blue",
  cancelled: "red",
};

// Hex colors matching STATUS_COLOR semantics for charts
const STATUS_HEX: Record<string, string> = {
  enquiry: "#868e96",
  quotation: "#1971c2",
  design: "#7048e8",
  approval: "#f59e0b",
  print: "#2f9e44",
  finishing: "#0c8599",
  qc: "#e67700",
  ready: "#2b8a3e",
  delivered: "#1864ab",
  cancelled: "#c92a2a",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const axisTickStyle = { fontSize: 11, fill: "#6b7280" };
const gridStyle = { stroke: "#f3f4f6", strokeDasharray: "3 3" as const };

interface Job {
  id: string;
  job_number: number;
  title: string;
  client_name: string;
  status: string;
  due_date: string;
  quoted_price: number;
  created_at?: string;
}

interface PagedJobs {
  data: Job[];
  total: number;
  meta?: { todayCount?: number; activeCount?: number };
}

export default function DashboardPage() {
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();

  const { data: jobsResult } = useQuery<PagedJobs>({
    queryKey: ["dashboard-jobs"],
    queryFn: async () => {
      const { data } = await api.get("/admin/jobs", { params: { limit: 5, sortBy: "created_at", sortDir: "desc" } });
      return data;
    },
  });

  // Larger fetch for charts — group by status & month
  const { data: chartJobsResult } = useQuery<PagedJobs>({
    queryKey: ["dashboard-jobs-chart"],
    queryFn: async () => {
      const { data } = await api.get("/admin/jobs", { params: { limit: 1000, sortBy: "created_at", sortDir: "desc" } });
      return data;
    },
  });

  const recentJobs: Job[] = jobsResult?.data ?? [];
  const totalJobs = jobsResult?.total ?? 0;
  const chartJobs: Job[] = chartJobsResult?.data ?? [];

  const activeJobs = recentJobs.filter((j) =>
    !["delivered", "cancelled"].includes(j.status)
  ).length;

  const statCards = [
    { label: "Total Jobs", value: totalJobs, icon: "📋", color: "#7c3aed", bg: "#ede9fe" },
    { label: "Active Jobs", value: activeJobs, icon: "⚙️", color: "#2563eb", bg: "#eff6ff" },
    { label: "Recent (shown)", value: recentJobs.length, icon: "🕐", color: "#059669", bg: "#d1fae5" },
    { label: "Pending Approval", value: recentJobs.filter((j) => j.status === "approval").length, icon: "✅", color: "#d97706", bg: "#fef3c7" },
  ];

  // --- Chart data derivations ---

  // Jobs by Status (Pie/Donut)
  const statusCounts: Record<string, number> = {};
  chartJobs.forEach((j) => {
    statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
  });
  const statusPieData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status,
    value: count,
    color: STATUS_HEX[status] ?? "#868e96",
  }));

  // Jobs by Month (Bar)
  const monthCounts: Record<string, number> = {};
  chartJobs.forEach((j) => {
    const date = j.created_at ? new Date(j.created_at) : null;
    if (!date || isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });
  const monthChartData = Object.entries(monthCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, count]) => {
      const monthIndex = parseInt(key.split("-")[1], 10);
      return { name: MONTH_NAMES[monthIndex] ?? key, Jobs: count };
    });

  const chartCardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    padding: 20,
  };

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ ...theme.pageTitle, marginBottom: 4 }}>Dashboard</h1>
          <p style={{ color: "#6b7280", fontSize: 13 }}>
            Welcome back — you are signed in as{" "}
            <span style={{ ...theme.badge("purple"), fontSize: 11 }}>
              {role ? (ROLE_LABEL[role] ?? role) : "—"}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={theme.btnPrimary} onClick={() => navigate("/jobs")}>+ New Job</button>
          <button style={theme.btnSecondary} onClick={() => navigate("/clients")}>+ New Client</button>
          <button style={theme.btnSecondary} onClick={() => navigate("/billing")}>+ New Invoice</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{ ...theme.card, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{s.label}</span>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                {s.icon}
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Chart 1 — Jobs by Status (Donut) */}
          <div style={chartCardStyle}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 16 }}>Jobs by Status</div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value ?? 0, "Jobs"]} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) => value}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 2 — Jobs Created per Month (Bar) */}
          <div style={chartCardStyle}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 16 }}>Jobs Created per Month</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="name" tick={axisTickStyle} />
                <YAxis tick={axisTickStyle} allowDecimals={false} />
                <Tooltip formatter={(value) => [value ?? 0, "Jobs"]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Jobs" fill="#7c3aed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      {/* Recent Jobs */}
      <div style={theme.card}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Recent Jobs</span>
          <button style={{ ...theme.btnSecondary, fontSize: 12, padding: "5px 12px" }} onClick={() => navigate("/jobs")}>
            View all
          </button>
        </div>
        {recentJobs.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            No jobs found. Create your first job to get started.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={theme.th}>#</th>
                <th style={theme.th}>Title</th>
                <th style={theme.th}>Client</th>
                <th style={theme.th}>Status</th>
                <th style={theme.th}>Due Date</th>
                <th style={{ ...theme.th, textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr
                  key={job.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate("/jobs")}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={theme.td}>
                    <span style={{ fontWeight: 600, color: "#7c3aed" }}>#{job.job_number}</span>
                  </td>
                  <td style={{ ...theme.td, fontWeight: 500, color: "#111827" }}>{job.title || "—"}</td>
                  <td style={theme.td}>{job.client_name || "—"}</td>
                  <td style={theme.td}>
                    <span style={theme.badge(STATUS_COLOR[job.status] ?? "gray")}>
                      {statusLabel(job.status)}
                    </span>
                  </td>
                  <td style={{ ...theme.td, color: "#6b7280" }}>
                    {job.due_date ? new Date(job.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td style={{ ...theme.td, textAlign: "right", fontWeight: 600 }}>
                    {job.quoted_price ? `₹${Number(job.quoted_price).toLocaleString("en-IN")}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
