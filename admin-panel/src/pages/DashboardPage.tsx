import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth.ts";
import { api } from "../lib/api.ts";
import * as theme from "../theme.ts";

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

interface Job {
  id: string;
  job_number: number;
  title: string;
  client_name: string;
  status: string;
  due_date: string;
  quoted_price: number;
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

  const recentJobs: Job[] = jobsResult?.data ?? [];
  const totalJobs = jobsResult?.total ?? 0;

  const activeJobs = recentJobs.filter((j) =>
    !["delivered", "cancelled"].includes(j.status)
  ).length;

  const statCards = [
    { label: "Total Jobs", value: totalJobs, icon: "📋", color: "#7c3aed", bg: "#ede9fe" },
    { label: "Active Jobs", value: activeJobs, icon: "⚙️", color: "#2563eb", bg: "#eff6ff" },
    { label: "Recent (shown)", value: recentJobs.length, icon: "🕐", color: "#059669", bg: "#d1fae5" },
    { label: "Pending Approval", value: recentJobs.filter((j) => j.status === "approval").length, icon: "✅", color: "#d97706", bg: "#fef3c7" },
  ];

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
                      {job.status}
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
