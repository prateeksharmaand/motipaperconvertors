import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";

type Permission = "jobs.view"|"jobs.create"|"jobs.edit"|"jobs.delete"|"quotation.view"|"quotation.create"|"quotation.edit_rates"|"production.view"|"production.update_status"|"inventory.view"|"inventory.edit"|"inventory.create_po"|"billing.view"|"billing.create_invoice"|"billing.record_payment"|"clients.view"|"clients.edit"|"staff.view"|"staff.manage"|"reports.view_financial"|"settings.edit";

const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  { label: "Jobs", perms: ["jobs.view","jobs.create","jobs.edit","jobs.delete"] },
  { label: "Quotation", perms: ["quotation.view","quotation.create","quotation.edit_rates"] },
  { label: "Production", perms: ["production.view","production.update_status"] },
  { label: "Inventory", perms: ["inventory.view","inventory.edit","inventory.create_po"] },
  { label: "Billing", perms: ["billing.view","billing.create_invoice","billing.record_payment"] },
  { label: "Clients", perms: ["clients.view","clients.edit"] },
  { label: "Staff", perms: ["staff.view","staff.manage"] },
  { label: "Reports", perms: ["reports.view_financial"] },
  { label: "Settings", perms: ["settings.edit"] },
];
const PERM_LABEL: Record<Permission, string> = {
  "jobs.view":"View","jobs.create":"Create","jobs.edit":"Edit","jobs.delete":"Delete",
  "quotation.view":"View","quotation.create":"Create","quotation.edit_rates":"Edit Rates",
  "production.view":"View","production.update_status":"Update Status",
  "inventory.view":"View","inventory.edit":"Edit","inventory.create_po":"Create PO",
  "billing.view":"View","billing.create_invoice":"Create Invoice","billing.record_payment":"Record Payment",
  "clients.view":"View","clients.edit":"Edit","staff.view":"View","staff.manage":"Manage",
  "reports.view_financial":"View Financial","settings.edit":"Edit Settings",
};

interface User { id: string; name: string; email: string; role: string; status: string; }

function PermissionMatrix({ userId, currentPerms }: { userId: string; currentPerms: Permission[] }) {
  const [selected, setSelected] = useState<Set<Permission>>(new Set(currentPerms));
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (perms: Permission[]) => api.patch(`/admin/users/${userId}/permissions`, { permissions: perms }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sub-admins"] }),
  });
  const toggle = (p: Permission) => setSelected(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  return (
    <div style={{ marginTop: 14 }}>
      {PERMISSION_GROUPS.map(g => (
        <div key={g.label} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>{g.label}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {g.perms.map(p => (
              <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13, padding: "3px 10px", borderRadius: 6, background: selected.has(p) ? "#eef2ff" : "#f5f5f5", border: `1px solid ${selected.has(p) ? "#3b5bdb" : "#ddd"}`, color: selected.has(p) ? "#3b5bdb" : "#555" }}>
                <input type="checkbox" checked={selected.has(p)} onChange={() => toggle(p)} style={{ accentColor: "#3b5bdb" }} />
                {PERM_LABEL[p]}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => save.mutate([...selected])} disabled={save.isPending} style={{ marginTop: 8, padding: "7px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
        {save.isPending ? "Saving…" : "Save Permissions"}
      </button>
    </div>
  );
}

export default function SubAdminsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const qc = useQueryClient();
  const [list, actions] = useListState({ sortBy: "created_at", filters: {} });

  const { data, isLoading } = useQuery<PagedResult<User>>({
    queryKey: ["sub-admins", actions.toParams()],
    queryFn: () => api.get("/admin/users", { params: { ...actions.toParams(), role: "sub_admin" } }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const invite = useMutation({
    mutationFn: () => api.post("/admin/users/invite", { name: inviteName, email: inviteEmail, role: "sub_admin" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sub-admins"] }); setShowInvite(false); setInviteName(""); setInviteEmail(""); },
  });

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Sub Admins</h1>
      {showInvite && (
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
          <h3 style={{ marginBottom: 16 }}>Invite Sub Admin</h3>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <input placeholder="Name" value={inviteName} onChange={e => setInviteName(e.target.value)} style={{ flex: 1, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }} />
            <input placeholder="Email" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => invite.mutate()} disabled={invite.isPending || !inviteName || !inviteEmail} style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>{invite.isPending ? "Inviting…" : "Send Invite"}</button>
            <button onClick={() => setShowInvite(false)} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
          </div>
        </div>
      )}
      <TableControls search={list.search} onSearch={actions.setSearch} placeholder="Search name, email…"
        activeFilters={list.filters} onFilter={actions.setFilter} onReset={actions.resetFilters}
        filters={[{ key: "status", label: "Status", options: [{ label: "Active", value: "active" }, { label: "Invited", value: "invited" }, { label: "Inactive", value: "inactive" }] }]}
        rightSlot={<button onClick={() => setShowInvite(true)} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ Invite</button>}
      />
      {isLoading ? <p>Loading…</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data?.data?.map((u) => (
            <div key={u.id} style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
              <div onClick={() => setExpanded(expanded === u.id ? null : u.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", cursor: "pointer" }}>
                <div><div style={{ fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 13, color: "#888" }}>{u.email}</div></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: u.status === "active" ? "#d3f9d8" : "#fff3bf", color: u.status === "active" ? "#2b8a3e" : "#e67700" }}>{u.status}</span>
                  <span style={{ color: "#aaa" }}>{expanded === u.id ? "▲" : "▼"}</span>
                </div>
              </div>
              {expanded === u.id && <div style={{ padding: "0 18px 18px" }}><PermissionMatrix userId={u.id} currentPerms={[]} /></div>}
            </div>
          ))}
          {!data?.data?.length && <p style={{ color: "#888" }}>No sub-admins yet.</p>}
        </div>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
