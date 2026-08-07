import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";

interface Tenant { id: string; name: string; slug: string; plan: string; status: string; created_at: string; }

const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

export default function TenantsPage() {
  const qc = useQueryClient();
  const [list, actions] = useListState({ sortBy: "created_at" });

  const { data, isLoading } = useQuery<PagedResult<Tenant>>({
    queryKey: ["tenants", actions.toParams()],
    queryFn: () => api.get("/platform/tenants", { params: actions.toParams() }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/platform/tenants/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants"] }),
  });

  const col = (label: string, key: string) => (
    <th style={th} onClick={() => actions.setSort(key)}>{label}<SortIcon col={key} sortBy={list.sortBy} sortDir={list.sortDir} /></th>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>All Tenants</h1>
      <TableControls search={list.search} onSearch={actions.setSearch} placeholder="Search press name, slug…"
        activeFilters={list.filters} onFilter={actions.setFilter} onReset={actions.resetFilters}
        filters={[
          { key: "status", label: "Status", options: [{ label: "Active", value: "active" }, { label: "Suspended", value: "suspended" }] },
          { key: "plan", label: "Plan", options: [{ label: "Free", value: "free" }, { label: "Starter", value: "starter" }, { label: "Pro", value: "pro" }] },
        ]} />
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {col("Press Name", "name")} {col("Slug", "slug")} {col("Plan", "plan")} {col("Status", "status")} {col("Joined", "created_at")} <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#888" }}>Loading…</td></tr>}
            {data?.data?.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ ...td, fontWeight: 500 }}>{t.name}</td>
                <td style={{ ...td, color: "#888" }}>{t.slug}</td>
                <td style={td}>{t.plan}</td>
                <td style={td}><span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: t.status === "active" ? "#d3f9d8" : "#ffe3e3", color: t.status === "active" ? "#2b8a3e" : "#c92a2a" }}>{t.status}</span></td>
                <td style={td}>{new Date(t.created_at).toLocaleDateString("en-IN")}</td>
                <td style={td}><button onClick={() => toggleStatus.mutate({ id: t.id, status: t.status === "active" ? "suspended" : "active" })} style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff" }}>{t.status === "active" ? "Suspend" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 0 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
