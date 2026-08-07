import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";

const STATUS_OPTIONS = [
  { label: "Enquiry", value: "enquiry" }, { label: "Quotation", value: "quotation" },
  { label: "Design", value: "design" }, { label: "Approval", value: "approval" },
  { label: "Print", value: "print" }, { label: "Finishing", value: "finishing" },
  { label: "QC", value: "qc" }, { label: "Ready", value: "ready" },
  { label: "Delivered", value: "delivered" }, { label: "Cancelled", value: "cancelled" },
];

const STATUS_COLOR: Record<string, string> = {
  enquiry: "#868e96", quotation: "#1971c2", design: "#7048e8", approval: "#f59f00",
  print: "#2f9e44", finishing: "#0c8599", qc: "#e67700", ready: "#2b8a3e",
  delivered: "#1864ab", cancelled: "#c92a2a",
};

const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

export default function JobsPage() {
  const [list, actions] = useListState({ sortBy: "created_at", filters: {} });

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", actions.toParams()],
    queryFn: () => api.get("/admin/jobs", { params: actions.toParams() }).then((r) => r.data),
    keepPreviousData: true,
  });

  const col = (label: string, key: string) => (
    <th style={th} onClick={() => actions.setSort(key)}>
      {label}<SortIcon col={key} sortBy={list.sortBy} sortDir={list.sortDir} />
    </th>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Job Cards</h1>
      <TableControls
        search={list.search}
        onSearch={actions.setSearch}
        placeholder="Search jobs, clients…"
        activeFilters={list.filters}
        onFilter={actions.setFilter}
        onReset={actions.resetFilters}
        filters={[
          { key: "status", label: "Status", options: STATUS_OPTIONS },
          { key: "dueDateFrom", label: "Due from", options: [] },
        ]}
      />

      {/* Date range quick controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
          Due from
          <input type="date" value={list.filters.dueDateFrom ?? ""} onChange={(e) => actions.setFilter("dueDateFrom", e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
          to
          <input type="date" value={list.filters.dueDateTo ?? ""} onChange={(e) => actions.setFilter("dueDateTo", e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        </label>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {col("#", "job_number")}
              {col("Title", "title")}
              <th style={th}>Client</th>
              {col("Status", "status")}
              {col("Due", "due_date")}
              {col("Quoted", "quoted_price")}
              <th style={th}>Operator</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#888" }}>Loading…</td></tr>
            )}
            {data?.data?.map((j: Record<string, string>) => (
              <tr key={j.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ ...td, color: "#888" }}>{j.job_number}</td>
                <td style={{ ...td, fontWeight: 500 }}>{j.title}</td>
                <td style={td}>{j.client_name ?? "—"}</td>
                <td style={td}>
                  <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: (STATUS_COLOR[j.status] ?? "#868e96") + "22", color: STATUS_COLOR[j.status] ?? "#868e96" }}>
                    {j.status}
                  </span>
                </td>
                <td style={td}>{j.due_date ?? "—"}</td>
                <td style={td}>{j.quoted_price ? "₹" + Number(j.quoted_price).toLocaleString("en-IN") : "—"}</td>
                <td style={td}>{j.operator_name ?? "—"}</td>
              </tr>
            ))}
            {!isLoading && data?.data?.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>No jobs found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
