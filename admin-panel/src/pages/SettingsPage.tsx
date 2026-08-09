import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useAuthStore } from "../store/auth.ts";

interface SettingItem { id: string; name: string; }

const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", fontWeight: 600 };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

function SettingsList({ label, queryKey, endpoint }: { label: string; queryKey: string; endpoint: string }) {
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery<SettingItem[]>({
    queryKey: [queryKey],
    queryFn: () => api.get(endpoint).then(r => r.data),
  });

  const add = useMutation({
    mutationFn: () => api.post(endpoint, { name: newName.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); setNewName(""); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const filtered = items
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 180, maxWidth: 260 }}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={`Add new ${label}...`}
          onKeyDown={e => { if (e.key === "Enter" && newName.trim()) add.mutate(); }}
        />
        <button
          onClick={() => add.mutate()}
          disabled={!newName.trim() || add.isPending}
          style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
        >
          {add.isPending ? "Adding..." : "Add"}
        </button>
        <div style={{ flex: 1 }} />
        <input
          style={{ ...inputStyle, width: 200 }}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={`Search ${label.toLowerCase()}...`}
        />
        <button
          onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          title="Toggle sort order"
          style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 13, whiteSpace: "nowrap" }}
        >
          A–Z {sortDir === "asc" ? "↑" : "↓"}
        </button>
      </div>
      <div style={{ padding: "8px 20px", borderBottom: "1px solid #eee", fontSize: 12, color: "#888" }}>
        {filtered.length} of {items.length} {label.toLowerCase()}s
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
            <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}>
              {label} {sortDir === "asc" ? "↑" : "↓"}
            </th>
            <th style={{ ...th, width: 60 }} />
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={2} style={{ ...td, textAlign: "center", color: "#888" }}>Loading...</td></tr>
          )}
          {paginated.map(item => (
            <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={td}>{item.name}</td>
              <td style={td}>
                <button
                  onClick={() => remove.mutate(item.id)}
                  disabled={remove.isPending}
                  style={{ padding: "3px 10px", border: "1px solid #fdd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff", color: "#c92a2a" }}
                >
                  &times;
                </button>
              </td>
            </tr>
          ))}
          {!isLoading && filtered.length === 0 && (
            <tr><td colSpan={2} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>
              {search ? `No results for "${search}"` : `No ${label.toLowerCase()} added yet`}
            </td></tr>
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid #eee", fontSize: 13 }}>
          <span style={{ color: "#888" }}>Page {page} of {totalPages} · {filtered.length} total</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 5, cursor: "pointer", background: "#fff", fontSize: 12 }}>«</button>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 5, cursor: "pointer", background: "#fff", fontSize: 12 }}>‹ Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 5, cursor: "pointer", background: "#fff", fontSize: 12 }}>Next ›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 5, cursor: "pointer", background: "#fff", fontSize: 12 }}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const role = useAuthStore(s => s.role);
  const [tab, setTab] = useState<"job_types" | "print_colors" | "plate_sources">("job_types");

  if (role === "staff" || role === "operator") return null;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    border: "none",
    borderBottom: active ? "2px solid #3b5bdb" : "2px solid transparent",
    background: "none",
    cursor: "pointer",
    fontWeight: active ? 700 : 400,
    color: active ? "#3b5bdb" : "#555",
    fontSize: 14,
  });

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Settings</h1>
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #eee", padding: "0 8px" }}>
          <button style={tabStyle(tab === "job_types")} onClick={() => setTab("job_types")}>Job Types</button>
          <button style={tabStyle(tab === "print_colors")} onClick={() => setTab("print_colors")}>Print Colors</button>
          <button style={tabStyle(tab === "plate_sources")} onClick={() => setTab("plate_sources")}>Plate Sources</button>
        </div>
        <div style={{ padding: 20 }}>
          {tab === "job_types" && (
            <SettingsList
              label="Job Type"
              queryKey="settings-job-types"
              endpoint="/admin/settings/job-types"
            />
          )}
          {tab === "print_colors" && (
            <SettingsList
              label="Print Color"
              queryKey="settings-print-colors"
              endpoint="/admin/settings/print-colors"
            />
          )}
          {tab === "plate_sources" && (
            <SettingsList
              label="Plate Source"
              queryKey="settings-plate-sources"
              endpoint="/admin/settings/plate-sources"
            />
          )}
        </div>
      </div>
    </div>
  );
}
