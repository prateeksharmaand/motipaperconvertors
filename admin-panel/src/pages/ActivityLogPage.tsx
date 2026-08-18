import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { fmtDate } from "../lib/fmtDate.ts";
import { exportToCsv } from "../lib/exportCsv.ts";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types ─────────────────────────────────────────────────
type ActivityLog = {
  id: string; user_id: string; user_name: string; user_email: string; user_role: string;
  category: string; action: string; module: string; feature: string; operation: string;
  description: string; entity_type: string; entity_id: string; entity_name: string;
  changed_fields: string[]; source: string; ip_address: string; status: string;
  created_at: string;
};
type ActivityLogDetail = ActivityLog & { before: unknown; after: unknown; metadata: unknown; request_id: string; http_method: string; http_path: string; response_status: number; duration_ms: number; };
type Summary = { total: number; today: number; failed: number; security: number; uniqueUsers: number; byDay: { date: string; count: number }[]; byModule: { module: string; count: number }[] };
type FiltersMeta = { modules: string[]; categories: string[]; actions: string[]; sources: string[] };

// ── Helpers ───────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = { SUCCESS: "#2b8a3e", FAILED: "#c92a2a", DENIED: "#e67700" };
const CATEGORY_COLOR: Record<string, string> = { AUTH: "#7c3aed", USER: "#1971c2", JOB: "#2f9e44", BILLING: "#0c8599", INVENTORY: "#f59f00", SECURITY: "#c92a2a", SYSTEM: "#868e96", PROOF: "#7048e8", QUOTATION: "#1864ab", SETTINGS: "#495057" };

const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: 12, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", borderBottom: "2px solid #e5e7eb" };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 12, borderBottom: "1px solid #f3f4f6", verticalAlign: "top" };
const inputStyle: React.CSSProperties = { padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, background: "#fff" };

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: color + "22", color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>{text}</span>;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: "#fff", padding: "16px 20px", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: `3px solid ${color}`, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{Number(value).toLocaleString("en-IN")}</div>
    </div>
  );
}

// ── Diff Viewer ───────────────────────────────────────────
function DiffViewer({ before, after, changedFields }: { before: unknown; after: unknown; changedFields: string[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!before && !after) return null;
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const allKeys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const keys = showAll ? allKeys : (changedFields?.length ? changedFields : allKeys.slice(0, 10));

  return (
    <div style={{ marginTop: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f8f9fa" }}>
            <th style={{ ...th, width: "30%", borderBottom: "1px solid #e5e7eb" }}>Field</th>
            <th style={{ ...th, borderBottom: "1px solid #e5e7eb" }}>Before</th>
            <th style={{ ...th, borderBottom: "1px solid #e5e7eb" }}>After</th>
          </tr>
        </thead>
        <tbody>
          {keys.map(k => {
            const changed = changedFields?.includes(k) ?? true;
            return (
              <tr key={k} style={{ background: changed ? "#fef9f0" : "#fff" }}>
                <td style={{ ...td, fontWeight: 600, color: changed ? "#e67700" : "#374151" }}>{k}</td>
                <td style={{ ...td, color: "#c92a2a", textDecoration: b[k] !== a[k] ? "line-through" : "none" }}>{b[k] != null ? String(b[k]) : "—"}</td>
                <td style={{ ...td, color: "#2b8a3e", fontWeight: changed ? 600 : 400 }}>{a[k] != null ? String(a[k]) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {allKeys.length > (changedFields?.length || 10) && (
        <button onClick={() => setShowAll(v => !v)} style={{ marginTop: 6, fontSize: 11, color: "#7c3aed", background: "none", border: "none", cursor: "pointer" }}>
          {showAll ? "Show changed fields only" : `Show all ${allKeys.length} fields`}
        </button>
      )}
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────
function DetailDrawer({ logId, onClose }: { logId: string; onClose: () => void }) {
  const { data: log, isLoading } = useQuery<ActivityLogDetail>({
    queryKey: ["activity-log-detail", logId],
    queryFn: () => api.get(`/admin/activity-logs/${logId}`).then(r => r.data),
  });

  const field = (label: string, value: unknown) => value ? (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#111827" }}>{String(value)}</div>
    </div>
  ) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 5000, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ width: 520, background: "#fff", height: "100%", overflowY: "auto", boxShadow: "-4px 0 24px rgba(0,0,0,0.15)", padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Activity Detail</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>
        {isLoading && <div style={{ color: "#888", fontSize: 13 }}>Loading…</div>}
        {log && (
          <>
            <div style={{ background: "#f8f9fa", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                {fmtDate(log.created_at)} {new Date(log.created_at).toLocaleTimeString("en-IN")}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{log.description || log.action}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginBottom: 16 }}>
              {field("User", log.user_name)}
              {field("Email", log.user_email)}
              {field("Role", log.user_role)}
              {field("Category", log.category)}
              {field("Action", log.action)}
              {field("Module", log.module)}
              {field("Feature", log.feature)}
              {field("Operation", log.operation)}
              {field("Entity Type", log.entity_type)}
              {field("Entity ID", log.entity_id)}
              {field("Entity Name", log.entity_name)}
              {field("Source", log.source)}
              {field("IP Address", log.ip_address)}
              {field("HTTP Method", log.http_method)}
              {field("HTTP Path", log.http_path)}
              {field("Response Status", log.response_status)}
              {field("Duration", log.duration_ms ? `${log.duration_ms}ms` : null)}
              {field("Request ID", log.request_id)}
            </div>

            <div style={{ marginBottom: 4 }}>
              <Badge text={log.status} color={STATUS_COLOR[log.status] ?? "#868e96"} />
            </div>

            {(log.before || log.after) && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Changes</div>
                <DiffViewer before={log.before} after={log.after} changedFields={log.changed_fields ?? []} />
              </div>
            )}

            {log.metadata && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, textTransform: "uppercase" }}>Metadata</div>
                <pre style={{ background: "#f8f9fa", borderRadius: 6, padding: 12, fontSize: 11, overflow: "auto", maxHeight: 200 }}>
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function ActivityLogPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "dashboard">("list");

  const setFilter = (k: string, v: string) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };
  const clearFilter = (k: string) => { setFilters(f => { const n = { ...f }; delete n[k]; return n; }); setPage(1); };

  const params = { page, limit, search, sortBy, sortDir, ...filters };

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", params],
    queryFn: () => api.get("/admin/activity-logs", { params }).then(r => r.data),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["activity-logs-summary"],
    queryFn: () => api.get("/admin/activity-logs/summary").then(r => r.data),
  });

  const { data: meta } = useQuery<FiltersMeta>({
    queryKey: ["activity-logs-meta"],
    queryFn: () => api.get("/admin/activity-logs/filters-meta").then(r => r.data),
  });

  function handleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  }

  function handleSearch() { setSearch(searchInput); setPage(1); }

  async function handleExport() {
    const rows: ActivityLog[] = [];
    let pg = 1;
    while (true) {
      const r = await api.get("/admin/activity-logs", { params: { ...params, page: pg, limit: 250 } });
      rows.push(...r.data.data);
      if (pg >= r.data.totalPages) break;
      pg++;
    }
    exportToCsv(`activity-logs-${new Date().toISOString().slice(0,10)}.csv`, rows.map(r => ({
      date: fmtDate(r.created_at),
      time: new Date(r.created_at).toLocaleTimeString("en-IN"),
      user: r.user_name, email: r.user_email, role: r.user_role,
      category: r.category, action: r.action, module: r.module,
      description: r.description, entity_type: r.entity_type,
      entity_id: r.entity_id, status: r.status, ip: r.ip_address, source: r.source,
    })));
  }

  const colHead = (label: string, key: string) => (
    <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort(key)}>
      {label} {sortBy === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  const logs: ActivityLog[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages: number = data?.totalPages ?? 1;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Activity Log</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {["list", "dashboard"].map(t => (
            <button key={t} onClick={() => setActiveTab(t as "list" | "dashboard")}
              style={{ padding: "7px 16px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, background: activeTab === t ? "#7c3aed" : "#f3f4f6", color: activeTab === t ? "#fff" : "#374151" }}>
              {t === "list" ? "📋 Log List" : "📊 Dashboard"}
            </button>
          ))}
          <button onClick={handleExport} style={{ padding: "7px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151" }}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard label="Total Activities" value={summary.total} color="#7c3aed" />
          <StatCard label="Today" value={summary.today} color="#1971c2" />
          <StatCard label="Unique Users" value={summary.uniqueUsers} color="#2f9e44" />
          <StatCard label="Failed" value={summary.failed} color="#c92a2a" />
          <StatCard label="Security Events" value={summary.security} color="#e67700" />
        </div>
      )}

      {activeTab === "dashboard" && summary && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#374151" }}>Activity Last 7 Days</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={summary.byDay.map(r => ({ day: r.date?.slice(5), count: Number(r.count) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#374151" }}>Activity by Module</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={summary.byModule.map(r => ({ module: r.module?.slice(0,12), count: Number(r.count) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="module" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="#1971c2" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "list" && (
        <>
          {/* Search + Filters */}
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <input
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Search user, action, entity, IP, description…"
                style={{ ...inputStyle, flex: 1, minWidth: 260 }}
              />
              <button onClick={handleSearch} style={{ padding: "7px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Search</button>
              {search && <button onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} style={{ ...inputStyle, color: "#6b7280", cursor: "pointer" }}>✕ Clear</button>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {/* Date presets */}
              {[["Today", 0], ["7 Days", 7], ["30 Days", 30]].map(([label, days]) => (
                <button key={label} onClick={() => {
                  const from = new Date(); from.setDate(from.getDate() - Number(days)); from.setHours(0,0,0,0);
                  setFilter("fromDate", from.toISOString().slice(0,10));
                  setFilter("toDate", new Date().toISOString().slice(0,10));
                }} style={{ ...inputStyle, cursor: "pointer", background: "#f8f9fa", fontSize: 12 }}>{label}</button>
              ))}
              <input type="date" value={filters.fromDate ?? ""} onChange={e => setFilter("fromDate", e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
              <input type="date" value={filters.toDate ?? ""} onChange={e => setFilter("toDate", e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />

              <select value={filters.category ?? ""} onChange={e => e.target.value ? setFilter("category", e.target.value) : clearFilter("category")} style={inputStyle}>
                <option value="">All Categories</option>
                {meta?.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filters.module ?? ""} onChange={e => e.target.value ? setFilter("module", e.target.value) : clearFilter("module")} style={inputStyle}>
                <option value="">All Modules</option>
                {meta?.modules.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={filters.action ?? ""} onChange={e => e.target.value ? setFilter("action", e.target.value) : clearFilter("action")} style={inputStyle}>
                <option value="">All Actions</option>
                {meta?.actions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filters.source ?? ""} onChange={e => e.target.value ? setFilter("source", e.target.value) : clearFilter("source")} style={inputStyle}>
                <option value="">All Sources</option>
                {meta?.sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filters.status ?? ""} onChange={e => e.target.value ? setFilter("status", e.target.value) : clearFilter("status")} style={inputStyle}>
                <option value="">All Status</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="DENIED">Denied</option>
              </select>
              {Object.keys(filters).length > 0 && (
                <button onClick={() => { setFilters({}); setPage(1); }} style={{ ...inputStyle, color: "#c92a2a", cursor: "pointer", fontSize: 12 }}>✕ Reset Filters</button>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {colHead("Date / Time", "created_at")}
                  {colHead("User", "user_name")}
                  <th style={th}>Role</th>
                  {colHead("Module", "module")}
                  {colHead("Action", "action")}
                  <th style={th}>Entity</th>
                  <th style={th}>Description</th>
                  {colHead("Status", "status")}
                  <th style={th}>Source</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 32, color: "#6b7280" }}>Loading…</td></tr>
                )}
                {!isLoading && logs.length === 0 && (
                  <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 32, color: "#6b7280" }}>No activity logs found</td></tr>
                )}
                {logs.map(log => (
                  <>
                    <tr key={log.id} style={{ background: expandedId === log.id ? "#faf5ff" : "#fff" }}>
                      <td style={{ ...td, whiteSpace: "nowrap", color: "#6b7280" }}>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{fmtDate(log.created_at)}</div>
                        <div style={{ fontSize: 11 }}>{new Date(log.created_at).toLocaleTimeString("en-IN")}</div>
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{log.user_name ?? "System"}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{log.user_email}</div>
                      </td>
                      <td style={td}><span style={{ fontSize: 11, color: "#374151" }}>{log.user_role ?? "—"}</span></td>
                      <td style={td}>
                        {log.module && <Badge text={log.module} color={CATEGORY_COLOR[log.category] ?? "#868e96"} />}
                      </td>
                      <td style={td}><span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{log.action}</span></td>
                      <td style={td}>
                        {log.entity_name && <div style={{ fontSize: 11, fontWeight: 600 }}>{log.entity_name}</div>}
                        {log.entity_type && <div style={{ fontSize: 10, color: "#9ca3af" }}>{log.entity_type}</div>}
                      </td>
                      <td style={{ ...td, maxWidth: 220 }}>
                        <div style={{ fontSize: 12, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.description ?? "—"}</div>
                        {log.changed_fields?.length > 0 && (
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>Changed: {log.changed_fields.join(", ")}</div>
                        )}
                      </td>
                      <td style={td}><Badge text={log.status} color={STATUS_COLOR[log.status] ?? "#868e96"} /></td>
                      <td style={td}><span style={{ fontSize: 11, color: "#6b7280" }}>{log.source ?? "—"}</span></td>
                      <td style={td}>
                        <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "#7c3aed" }}>
                          {expandedId === log.id ? "▲" : "▼"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={log.id + "_detail"}>
                        <td colSpan={10} style={{ background: "#faf5ff", padding: "0 16px 16px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, padding: "12px 0 8px" }}>
                            {[
                              ["IP Address", log.ip_address],
                              ["Source", log.source],
                              ["Category", log.category],
                              ["Operation", log.operation],
                              ["Entity ID", log.entity_id],
                            ].map(([k, v]) => v ? (
                              <div key={k}>
                                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                                <div style={{ fontSize: 12, color: "#111827" }}>{v}</div>
                              </div>
                            ) : null)}
                          </div>
                          <button onClick={() => setExpandedId("__drawer__" + log.id)}
                            style={{ fontSize: 12, color: "#7c3aed", background: "none", border: "1px solid #7c3aed", borderRadius: 5, padding: "4px 10px", cursor: "pointer", marginTop: 4 }}>
                            View Full Details →
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString("en-IN")} activities
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} style={{ ...inputStyle, fontSize: 12 }}>
                {[25, 50, 100, 250].map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
              <button onClick={() => setPage(1)} disabled={page === 1} style={{ ...inputStyle, cursor: "pointer", fontSize: 12 }}>«</button>
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={{ ...inputStyle, cursor: "pointer", fontSize: 12 }}>‹ Prev</button>
              <span style={{ fontSize: 13, color: "#374151", minWidth: 80, textAlign: "center" }}>Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} style={{ ...inputStyle, cursor: "pointer", fontSize: 12 }}>Next ›</button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={{ ...inputStyle, cursor: "pointer", fontSize: 12 }}>»</button>
            </div>
          </div>
        </>
      )}

      {/* Full detail drawer */}
      {expandedId?.startsWith("__drawer__") && (
        <DetailDrawer logId={expandedId.replace("__drawer__", "")} onClose={() => setExpandedId(null)} />
      )}
    </div>
  );
}
