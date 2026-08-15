import PrintListButton from "../components/PrintListButton.tsx";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { exportToCsv } from "../lib/exportCsv.ts";

interface Machine { id: string; name: string; type: string; model: string; max_colors: number; status: string; notes: string; }

const STATUS_COLOR: Record<string, string> = { active: "#2b8a3e", maintenance: "#e67700", inactive: "#868e96" };
const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14 };

function MachineForm({ initial, onSave, onCancel }: { initial?: Partial<Machine>; onSave: (d: Record<string, string>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", type: "", model: "", max_colors: "", status: "active", notes: "", ...initial });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>{initial?.id ? "Edit Machine" : "New Machine"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <label><span style={{ fontSize: 13 }}>Name *</span><input style={inputStyle} value={form.name} onChange={set("name")} /></label>
        <label><span style={{ fontSize: 13 }}>Type</span><input style={inputStyle} placeholder="offset, digital, screen…" value={form.type} onChange={set("type")} /></label>
        <label><span style={{ fontSize: 13 }}>Model</span><input style={inputStyle} value={form.model} onChange={set("model")} /></label>
        <label><span style={{ fontSize: 13 }}>Max Colors</span><input style={inputStyle} type="number" value={form.max_colors} onChange={set("max_colors")} /></label>
        <label><span style={{ fontSize: 13 }}>Status</span>
          <select style={inputStyle} value={form.status} onChange={set("status")}>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      <label><span style={{ fontSize: 13 }}>Notes</span><textarea style={{ ...inputStyle, height: 64 }} value={form.notes} onChange={set("notes")} /></label>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => onSave(form as Record<string, string>)} style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>Save</button>
        <button onClick={onCancel} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

export default function MachinesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get("/admin/machines", { params: { limit: 5000 } });
      const machineList: Machine[] = res.data.data ?? [];
      const date = new Date().toISOString().slice(0, 10);
      const rows = machineList.map(m => ({
        name: m.name, type: m.type, model: m.model,
        max_colors: m.max_colors, status: m.status, notes: m.notes,
      }));
      exportToCsv(`machines-${date}.csv`, rows);
    } finally {
      setExporting(false);
    }
  }

  const { data: machinesResult, isLoading } = useQuery<{ data: Machine[] }>({
    queryKey: ["machines"],
    queryFn: () => api.get("/admin/machines").then(r => r.data),
  });
  const machines = machinesResult?.data ?? [];

  const create = useMutation({
    mutationFn: (d: Record<string, string>) => api.post("/admin/machines", { name: d.name, type: d.type, model: d.model, maxColors: Number(d.max_colors) || undefined, status: d.status, notes: d.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["machines"] }); setShowForm(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }: Record<string, string>) => api.patch(`/admin/machines/${id}`, { name: d.name, type: d.type, model: d.model, maxColors: Number(d.max_colors) || undefined, status: d.status, notes: d.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["machines"] }); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/machines/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["machines"] }),
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Machines</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <PrintListButton />
          <button onClick={handleExport} disabled={exporting} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exporting ? "Exporting…" : "⬇ Export"}</button>
          <button onClick={() => setShowForm(true)} style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>+ New Machine</button>
        </div>
      </div>
      {showForm && <MachineForm onSave={(d) => create.mutate(d)} onCancel={() => setShowForm(false)} />}
      {editing && <MachineForm initial={editing} onSave={(d) => update.mutate({ id: editing.id, ...d })} onCancel={() => setEditing(null)} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
        {machines.map(m => (
          <div key={m.id} style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #eee" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: "#888" }}>{m.type}{m.model ? ` · ${m.model}` : ""}</div>
              </div>
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: STATUS_COLOR[m.status] + "22", color: STATUS_COLOR[m.status], fontWeight: 600 }}>
                {m.status}
              </span>
            </div>
            {m.max_colors && <div style={{ fontSize: 13, color: "#555", marginTop: 8 }}>{m.max_colors} color{m.max_colors !== 1 ? "s" : ""}</div>}
            {m.notes && <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{m.notes}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setEditing(m)} style={{ flex: 1, padding: "6px 0", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff" }}>Edit</button>
              <button onClick={() => remove.mutate(m.id)} style={{ flex: 1, padding: "6px 0", border: "1px solid #fdd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff", color: "#c92a2a" }}>Delete</button>
            </div>
          </div>
        ))}
        {machines.length === 0 && <p style={{ color: "#888" }}>No machines configured yet.</p>}
      </div>
    </div>
  );
}
