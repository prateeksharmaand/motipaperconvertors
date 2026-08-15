import PrintListButton from "../components/PrintListButton.tsx";
import IconButton from "../components/IconButton.tsx";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";
import { exportToCsv } from "../lib/exportCsv.ts";

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  staff_type: string | null;
}

interface SettingItem { id: string; name: string; }

const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14, boxSizing: "border-box" };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

const labelStyle: React.CSSProperties = { fontSize: 13, color: "#444", display: "flex", flexDirection: "column", gap: 4 };
const reqMark: React.CSSProperties = { color: "#c92a2a", marginLeft: 2 };

type FormState = {
  name: string;
  email: string;
  password: string;
  staffType: string;
  status: string;
};

function initForm(initial?: Partial<StaffMember>): FormState {
  return {
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    password: "",
    staffType: initial?.staff_type ?? "",
    status: initial?.status ?? "active",
  };
}

function StaffModal({
  initial,
  staffTypes,
  onSave,
  onCancel,
  isPending,
  isEdit,
}: {
  initial?: Partial<StaffMember>;
  staffTypes: SettingItem[];
  onSave: (f: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
  isEdit: boolean;
}) {
  const [form, setForm] = useState<FormState>(() => initForm(initial));
  const [error, setError] = useState("");

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!isEdit && form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError("");
    onSave(form);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
    }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 32, width: 480, maxWidth: "95vw", boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
        <h3 style={{ margin: "0 0 24px", fontSize: 17 }}>{isEdit ? "Edit Staff Member" : "Add Staff Member"}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={labelStyle}>
            Name<span style={reqMark}>*</span>
            <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Full name" />
          </label>
          <label style={labelStyle}>
            Email<span style={reqMark}>*</span>
            <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="email@example.com" />
          </label>
          {!isEdit && (
            <label style={labelStyle}>
              Password<span style={reqMark}>*</span>
              <input style={inputStyle} type="password" value={form.password} onChange={set("password")} placeholder="Min 6 characters" />
            </label>
          )}
          <label style={labelStyle}>
            Staff Type
            <select style={inputStyle} value={form.staffType} onChange={set("staffType")}>
              <option value="">— select staff type —</option>
              {staffTypes.map(st => (
                <option key={st.id} value={st.name}>{st.name}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Status
            <select style={inputStyle} value={form.status} onChange={set("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        {error && <div style={{ color: "#c92a2a", fontSize: 13, marginTop: 12, fontWeight: 500 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{ padding: "8px 18px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            style={{ padding: "8px 22px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: isPending ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14, opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Staff"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get("/admin/users", { params: { role: "operator", limit: 5000 } });
      const list: StaffMember[] = res.data.data ?? [];
      const date = new Date().toISOString().slice(0, 10);
      exportToCsv(`staff-${date}.csv`, list.map(u => ({
        name: u.name, email: u.email ?? "", staff_type: u.staff_type ?? "", status: u.status,
      })));
    } finally { setExporting(false); }
  }
  const [list, actions] = useListState({ sortBy: "name", filters: {} });

  const { data, isLoading } = useQuery<PagedResult<StaffMember>>({
    queryKey: ["staff", actions.toParams()],
    queryFn: () =>
      api.get("/admin/users", {
        params: { ...actions.toParams(), role: "operator", limit: 20 },
      }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const { data: staffTypes = [] } = useQuery<SettingItem[]>({
    queryKey: ["settings-staff-types"],
    queryFn: () => api.get("/admin/settings/staff-types").then(r => r.data),
  });

  const create = useMutation({
    mutationFn: (form: FormState) =>
      api.post("/admin/users", {
        name: form.name,
        email: form.email,
        password: form.password,
        staffType: form.staffType,
        status: form.status,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); setShowAdd(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, form }: { id: string; form: FormState }) =>
      api.patch(`/admin/users/${id}`, {
        name: form.name,
        email: form.email,
        staff_type: form.staffType,
        status: form.status,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); setEditing(null); },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/users/${id}/status`, {
        status: status === "active" ? "inactive" : "active",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); setDeleteConfirm(null); },
  });

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Staff Management</h1>

      {showAdd && (
        <StaffModal
          staffTypes={staffTypes}
          onSave={(form) => create.mutate(form)}
          onCancel={() => setShowAdd(false)}
          isPending={create.isPending}
          isEdit={false}
        />
      )}

      {editing && (
        <StaffModal
          initial={editing}
          staffTypes={staffTypes}
          onSave={(form) => update.mutate({ id: editing.id, form })}
          onCancel={() => setEditing(null)}
          isPending={update.isPending}
          isEdit={true}
        />
      )}

      {deleteConfirm && (
        <div style={{ background: "#fff3f3", border: "1px solid #fdd", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14 }}>Permanently delete this staff member? This cannot be undone.</span>
          <button onClick={() => remove.mutate(deleteConfirm)} disabled={remove.isPending}
            style={{ padding: "6px 16px", background: "#c92a2a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            {remove.isPending ? "Deleting..." : "Confirm Delete"}
          </button>
          <button onClick={() => setDeleteConfirm(null)} style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 13 }}>Cancel</button>
        </div>
      )}

      <TableControls
        search={list.search}
        onSearch={actions.setSearch}
        placeholder="Search name, email..."
        activeFilters={list.filters}
        onFilter={actions.setFilter}
        onReset={actions.resetFilters}
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ]}
        rightSlot={
          <div style={{ display: "flex", gap: 8 }}>
            <PrintListButton />
            <button onClick={handleExport} disabled={exporting} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exporting ? "Exporting…" : "⬇ Export"}</button>
            <button
              onClick={() => setShowAdd(true)}
              style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}
            >
              + Add Staff
            </button>
          </div>
        }
      />

      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              <th style={th} onClick={() => actions.setSort("name")} role="button">Name</th>
              <th style={th}>Email</th>
              <th style={th}>Staff Type</th>
              <th style={th}>Status</th>
              <th style={{ ...th, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#888" }}>Loading...</td></tr>
            )}
            {data?.data?.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ ...td, fontWeight: 500 }}>{u.name}</td>
                <td style={td}>{u.email ?? "—"}</td>
                <td style={td}>{u.staff_type ?? "—"}</td>
                <td style={td}>
                  <span style={{
                    padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                    background: u.status === "active" ? "#d3f9d822" : "#fff3bf22",
                    color: u.status === "active" ? "#2b8a3e" : "#e67700",
                    border: `1px solid ${u.status === "active" ? "#d3f9d8" : "#ffe066"}`,
                  }}>
                    {u.status}
                  </span>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <IconButton icon="✏️" tooltip="Edit" onClick={() => setEditing(u)} />
                    <IconButton icon={u.status === "active" ? "🔴" : "🟢"} tooltip={u.status === "active" ? "Deactivate" : "Activate"} onClick={() => toggleStatus.mutate({ id: u.id, status: u.status })} disabled={toggleStatus.isPending} danger={u.status === "active"} success={u.status !== "active"} />
                    {u.status === "inactive" && (
                      <IconButton icon="🗑️" tooltip="Delete" onClick={() => setDeleteConfirm(u.id)} danger />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.data?.length && (
              <tr>
                <td colSpan={5} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>
                  No staff members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPage={actions.setPage}
        />
      )}
    </div>
  );
}
