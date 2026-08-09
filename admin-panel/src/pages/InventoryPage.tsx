import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";
import { exportToCsv } from "../lib/exportCsv.ts";

type Tab = "paper" | "items" | "transactions";
const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14 };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

type PaperItem = { id: string; name: string; brand: string; gsm: number; size: string; unit: string; quantity: number; low_stock_threshold: number; is_low: boolean; };
type InvItem   = { id: string; name: string; category: string; unit: string; quantity: number; low_stock_threshold: number; is_low: boolean; };
type TxnItem   = { id: string; transacted_at: string; type: string; quantity: number; performed_by_name: string; notes: string; paper_name: string; item_name: string; };

function StockBadge({ isLow, qty, unit }: { isLow: boolean; qty: number; unit: string }) {
  return <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: isLow ? "#ffe3e3" : "#d3f9d8", color: isLow ? "#c92a2a" : "#2b8a3e" }}>{qty} {unit}{isLow ? " ⚠" : ""}</span>;
}

function TxnForm({ target, onClose }: { target: { id: string; isPaper: boolean; name: string }; onClose: () => void }) {
  const [form, setForm] = useState({ type: "in", quantity: "", notes: "", unitCost: "" });
  const qc = useQueryClient();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => api.post("/admin/inventory/transactions", {
      ...(target.isPaper ? { paperStockId: target.id } : { inventoryItemId: target.id }),
      type: form.type, quantity: Number(form.quantity),
      notes: form.notes || undefined, unitCost: form.unitCost ? Number(form.unitCost) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paper"] });
      qc.invalidateQueries({ queryKey: ["inv-items"] });
      qc.invalidateQueries({ queryKey: ["inv-txns"] });
      onClose();
    },
  });
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>Record Transaction — {target.name}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label><span style={{ fontSize: 13 }}>Type</span>
          <select style={inputStyle} value={form.type} onChange={set("type")}>
            <option value="in">Stock In</option><option value="out">Stock Out</option>
            <option value="wastage">Wastage</option><option value="adjustment">Adjustment</option>
          </select>
        </label>
        <label><span style={{ fontSize: 13 }}>Quantity *</span><input style={inputStyle} type="number" value={form.quantity} onChange={set("quantity")} /></label>
        <label><span style={{ fontSize: 13 }}>Unit Cost (₹)</span><input style={inputStyle} type="number" value={form.unitCost} onChange={set("unitCost")} /></label>
      </div>
      <label><span style={{ fontSize: 13 }}>Notes</span><input style={inputStyle} value={form.notes} onChange={set("notes")} /></label>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => save.mutate()} disabled={!form.quantity || save.isPending} style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>{save.isPending ? "Saving…" : "Record"}</button>
        <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

function PaperForm({ initial, onSave, onCancel, isPending }: { initial?: Partial<PaperItem>; onSave: (d: Record<string, string>) => void; onCancel: () => void; isPending: boolean }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    brand: initial?.brand ?? "",
    gsm: initial?.gsm?.toString() ?? "",
    size: initial?.size ?? "",
    unit: initial?.unit ?? "sheets",
    quantity: initial?.quantity?.toString() ?? "",
    low_stock_threshold: initial?.low_stock_threshold?.toString() ?? "",
    cost_per_unit: "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>{initial?.id ? "Edit Paper" : "Add Paper"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label><span style={{ fontSize: 13 }}>Name *</span><input style={inputStyle} value={form.name} onChange={set("name")} /></label>
        <label><span style={{ fontSize: 13 }}>Brand</span><input style={inputStyle} value={form.brand} onChange={set("brand")} /></label>
        <label><span style={{ fontSize: 13 }}>GSM</span><input style={inputStyle} type="number" value={form.gsm} onChange={set("gsm")} /></label>
        <label><span style={{ fontSize: 13 }}>Size</span><input style={inputStyle} placeholder="e.g. A4, 28x40" value={form.size} onChange={set("size")} /></label>
        <label><span style={{ fontSize: 13 }}>Unit</span><input style={inputStyle} value={form.unit} onChange={set("unit")} /></label>
        <label><span style={{ fontSize: 13 }}>Quantity</span><input style={inputStyle} type="number" value={form.quantity} onChange={set("quantity")} /></label>
        <label><span style={{ fontSize: 13 }}>Reorder Level</span><input style={inputStyle} type="number" value={form.low_stock_threshold} onChange={set("low_stock_threshold")} /></label>
        <label><span style={{ fontSize: 13 }}>Cost/Unit (₹)</span><input style={inputStyle} type="number" value={form.cost_per_unit} onChange={set("cost_per_unit")} /></label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave(form as unknown as Record<string, string>)} disabled={!form.name || isPending} style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>{isPending ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

function ItemForm({ initial, onSave, onCancel, isPending }: { initial?: Partial<InvItem>; onSave: (d: Record<string, string>) => void; onCancel: () => void; isPending: boolean }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    category: initial?.category ?? "ink",
    unit: initial?.unit ?? "pcs",
    quantity: initial?.quantity?.toString() ?? "",
    low_stock_threshold: initial?.low_stock_threshold?.toString() ?? "",
    cost_per_unit: "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>{initial?.id ? "Edit Item" : "Add Item"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label><span style={{ fontSize: 13 }}>Name *</span><input style={inputStyle} value={form.name} onChange={set("name")} /></label>
        <label><span style={{ fontSize: 13 }}>Category</span>
          <select style={inputStyle} value={form.category} onChange={set("category")}>
            <option value="ink">Ink</option><option value="plate">Plate</option>
            <option value="consumable">Consumable</option><option value="other">Other</option>
          </select>
        </label>
        <label><span style={{ fontSize: 13 }}>Unit</span><input style={inputStyle} value={form.unit} onChange={set("unit")} /></label>
        <label><span style={{ fontSize: 13 }}>Quantity</span><input style={inputStyle} type="number" value={form.quantity} onChange={set("quantity")} /></label>
        <label><span style={{ fontSize: 13 }}>Reorder Level</span><input style={inputStyle} type="number" value={form.low_stock_threshold} onChange={set("low_stock_threshold")} /></label>
        <label><span style={{ fontSize: 13 }}>Cost/Unit (₹)</span><input style={inputStyle} type="number" value={form.cost_per_unit} onChange={set("cost_per_unit")} /></label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave(form as unknown as Record<string, string>)} disabled={!form.name || isPending} style={{ padding: "8px 20px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>{isPending ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("paper");
  const [txnTarget, setTxnTarget] = useState<{ id: string; isPaper: boolean; name: string } | null>(null);
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [editingPaper, setEditingPaper] = useState<PaperItem | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InvItem | null>(null);
  const [exportingPaper, setExportingPaper] = useState(false);
  const [exportingItems, setExportingItems] = useState(false);
  const [exportingTxns, setExportingTxns] = useState(false);
  const qcInv = useQueryClient();

  async function handleExportPaper() {
    setExportingPaper(true);
    try {
      const res = await api.get("/admin/inventory/paper", { params: { limit: 5000 } });
      const list: PaperItem[] = res.data.data ?? [];
      const date = new Date().toISOString().slice(0, 10);
      exportToCsv(`paper-stock-${date}.csv`, list.map(p => ({
        name: p.name, brand: p.brand, gsm: p.gsm, size: p.size,
        unit: p.unit, quantity: p.quantity, low_stock_threshold: p.low_stock_threshold,
      })));
    } finally { setExportingPaper(false); }
  }

  async function handleExportItems() {
    setExportingItems(true);
    try {
      const res = await api.get("/admin/inventory/items", { params: { limit: 5000 } });
      const list: InvItem[] = res.data.data ?? [];
      const date = new Date().toISOString().slice(0, 10);
      exportToCsv(`inventory-items-${date}.csv`, list.map(i => ({
        name: i.name, category: i.category, unit: i.unit,
        quantity: i.quantity, low_stock_threshold: i.low_stock_threshold,
      })));
    } finally { setExportingItems(false); }
  }

  async function handleExportTxns() {
    setExportingTxns(true);
    try {
      const res = await api.get("/admin/inventory/transactions", { params: { limit: 5000 } });
      const list: TxnItem[] = res.data.data ?? [];
      const date = new Date().toISOString().slice(0, 10);
      exportToCsv(`inventory-transactions-${date}.csv`, list.map(t => ({
        transacted_at: t.transacted_at, paper_name: t.paper_name, item_name: t.item_name,
        type: t.type, quantity: t.quantity, performed_by_name: t.performed_by_name, notes: t.notes,
      })));
    } finally { setExportingTxns(false); }
  }

  const [paperList, paperActions] = useListState({ sortBy: "name" });
  const [itemList, itemActions]   = useListState({ sortBy: "name" });
  const [txnList, txnActions]     = useListState({ sortBy: "transacted_at" });

  const { data: paper } = useQuery<PagedResult<PaperItem>>({ queryKey: ["paper", paperActions.toParams()], queryFn: () => api.get("/admin/inventory/paper", { params: paperActions.toParams() }).then(r => r.data), placeholderData: keepPreviousData });
  const { data: items } = useQuery<PagedResult<InvItem>>({ queryKey: ["inv-items", itemActions.toParams()], queryFn: () => api.get("/admin/inventory/items", { params: itemActions.toParams() }).then(r => r.data), placeholderData: keepPreviousData });
  const { data: txns }  = useQuery<PagedResult<TxnItem>>({ queryKey: ["inv-txns", txnActions.toParams()], queryFn: () => api.get("/admin/inventory/transactions", { params: txnActions.toParams() }).then(r => r.data), placeholderData: keepPreviousData });

  const createPaper = useMutation({
    mutationFn: (d: Record<string, string>) => api.post("/admin/inventory/paper", { name: d.name, brand: d.brand || undefined, gsm: d.gsm ? Number(d.gsm) : undefined, size: d.size || undefined, unit: d.unit || "sheets", quantity: d.quantity ? Number(d.quantity) : 0, lowStockThreshold: d.low_stock_threshold ? Number(d.low_stock_threshold) : 100, costPerUnit: d.cost_per_unit ? Number(d.cost_per_unit) : undefined }),
    onSuccess: () => { qcInv.invalidateQueries({ queryKey: ["paper"] }); setShowPaperForm(false); },
  });
  const updatePaper = useMutation({
    mutationFn: ({ id, ...d }: Record<string, string>) => api.patch(`/admin/inventory/paper/${id}`, { name: d.name, brand: d.brand || undefined, gsm: d.gsm ? Number(d.gsm) : undefined, size: d.size || undefined, unit: d.unit || undefined, quantity: d.quantity ? Number(d.quantity) : undefined, lowStockThreshold: d.low_stock_threshold ? Number(d.low_stock_threshold) : undefined, costPerUnit: d.cost_per_unit ? Number(d.cost_per_unit) : undefined }),
    onSuccess: () => { qcInv.invalidateQueries({ queryKey: ["paper"] }); setEditingPaper(null); },
  });
  const createItem = useMutation({
    mutationFn: (d: Record<string, string>) => api.post("/admin/inventory/items", { name: d.name, category: d.category, unit: d.unit || "pcs", quantity: d.quantity ? Number(d.quantity) : 0, lowStockThreshold: d.low_stock_threshold ? Number(d.low_stock_threshold) : 10, costPerUnit: d.cost_per_unit ? Number(d.cost_per_unit) : undefined }),
    onSuccess: () => { qcInv.invalidateQueries({ queryKey: ["inv-items"] }); setShowItemForm(false); },
  });
  const updateItem = useMutation({
    mutationFn: ({ id, ...d }: Record<string, string>) => api.patch(`/admin/inventory/items/${id}`, { name: d.name, category: d.category, unit: d.unit || undefined, quantity: d.quantity ? Number(d.quantity) : undefined, lowStockThreshold: d.low_stock_threshold ? Number(d.low_stock_threshold) : undefined, costPerUnit: d.cost_per_unit ? Number(d.cost_per_unit) : undefined }),
    onSuccess: () => { qcInv.invalidateQueries({ queryKey: ["inv-items"] }); setEditingItem(null); },
  });

  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: tab === t ? "#3b5bdb" : "#eee", color: tab === t ? "#fff" : "#444", fontWeight: 600, cursor: "pointer" }}>{label}</button>
  );

  const col = (label: string, key: string, act: typeof paperActions, lst: typeof paperList) => (
    <th style={th} onClick={() => act.setSort(key)}>{label}<SortIcon col={key} sortBy={lst.sortBy} sortDir={lst.sortDir} /></th>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Inventory</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>{tabBtn("paper", "Paper Stock")}{tabBtn("items", "Ink / Plates")}{tabBtn("transactions", "Transactions")}</div>
      {txnTarget && <TxnForm target={txnTarget} onClose={() => setTxnTarget(null)} />}

      {tab === "paper" && (
        <>
          {showPaperForm && <PaperForm isPending={createPaper.isPending} onSave={(d) => createPaper.mutate(d)} onCancel={() => setShowPaperForm(false)} />}
          {editingPaper && <PaperForm initial={editingPaper} isPending={updatePaper.isPending} onSave={(d) => updatePaper.mutate({ id: editingPaper.id, ...d })} onCancel={() => setEditingPaper(null)} />}
          <TableControls search={paperList.search} onSearch={paperActions.setSearch} placeholder="Search paper…" activeFilters={paperList.filters} onFilter={paperActions.setFilter} onReset={paperActions.resetFilters}
            filters={[{ key: "isLow", label: "Low Stock", options: [{ label: "Low only", value: "1" }] }]}
            rightSlot={<div style={{ display: "flex", gap: 8 }}><button onClick={handleExportPaper} disabled={exportingPaper} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exportingPaper ? "Exporting…" : "⬇ Export Paper"}</button><button onClick={() => setShowPaperForm(true)} style={{ padding: "8px 16px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ Add Paper</button></div>} />
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {col("Name", "name", paperActions, paperList)} {col("Brand", "brand", paperActions, paperList)}
                {col("GSM", "gsm", paperActions, paperList)} <th style={th}>Size</th>
                {col("Stock", "quantity", paperActions, paperList)} <th style={th} />
              </tr></thead>
              <tbody>
                {paper?.data?.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0", background: p.is_low ? "#fff9f9" : "#fff" }}>
                    <td style={{ ...td, fontWeight: 500 }}>{p.name}</td>
                    <td style={td}>{p.brand || "—"}</td>
                    <td style={td}>{p.gsm || "—"}</td>
                    <td style={td}>{p.size || "—"}</td>
                    <td style={td}><StockBadge isLow={p.is_low} qty={p.quantity} unit={p.unit} /></td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setEditingPaper(p)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }}>Edit</button>
                        <button onClick={() => setTxnTarget({ id: p.id, isPaper: true, name: p.name })} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }}>+ Stock</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!paper?.data?.length && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>No paper stock</td></tr>}
              </tbody>
            </table>
          </div>
          {paper && <Pagination page={paper.page} totalPages={paper.totalPages} total={paper.total} limit={paper.limit} onPage={paperActions.setPage} />}
        </>
      )}

      {tab === "items" && (
        <>
          {showItemForm && <ItemForm isPending={createItem.isPending} onSave={(d) => createItem.mutate(d)} onCancel={() => setShowItemForm(false)} />}
          {editingItem && <ItemForm initial={editingItem} isPending={updateItem.isPending} onSave={(d) => updateItem.mutate({ id: editingItem.id, ...d })} onCancel={() => setEditingItem(null)} />}
          <TableControls search={itemList.search} onSearch={itemActions.setSearch} placeholder="Search items…" activeFilters={itemList.filters} onFilter={itemActions.setFilter} onReset={itemActions.resetFilters}
            filters={[{ key: "category", label: "Category", options: [{ label: "Ink", value: "ink" }, { label: "Plate", value: "plate" }, { label: "Consumable", value: "consumable" }] }, { key: "isLow", label: "Low Stock", options: [{ label: "Low only", value: "1" }] }]}
            rightSlot={<div style={{ display: "flex", gap: 8 }}><button onClick={handleExportItems} disabled={exportingItems} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exportingItems ? "Exporting…" : "⬇ Export Items"}</button><button onClick={() => setShowItemForm(true)} style={{ padding: "8px 16px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ Add Item</button></div>} />
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {col("Name", "name", itemActions, itemList)} {col("Category", "category", itemActions, itemList)}
                {col("Stock", "quantity", itemActions, itemList)} <th style={th} />
              </tr></thead>
              <tbody>
                {items?.data?.map((i) => (
                  <tr key={i.id} style={{ borderBottom: "1px solid #f0f0f0", background: i.is_low ? "#fff9f9" : "#fff" }}>
                    <td style={{ ...td, fontWeight: 500 }}>{i.name}</td>
                    <td style={td}>{i.category}</td>
                    <td style={td}><StockBadge isLow={i.is_low} qty={i.quantity} unit={i.unit} /></td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setEditingItem(i)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }}>Edit</button>
                        <button onClick={() => setTxnTarget({ id: i.id, isPaper: false, name: i.name })} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }}>+ Stock</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items && <Pagination page={items.page} totalPages={items.totalPages} total={items.total} limit={items.limit} onPage={itemActions.setPage} />}
        </>
      )}

      {tab === "transactions" && (
        <>
          <TableControls search={txnList.search} onSearch={txnActions.setSearch} placeholder="Search notes…" activeFilters={txnList.filters} onFilter={txnActions.setFilter} onReset={txnActions.resetFilters}
            filters={[{ key: "type", label: "Type", options: [{ label: "In", value: "in" }, { label: "Out", value: "out" }, { label: "Wastage", value: "wastage" }, { label: "Adjustment", value: "adjustment" }] }]}
            rightSlot={<button onClick={handleExportTxns} disabled={exportingTxns} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exportingTxns ? "Exporting…" : "⬇ Export Txns"}</button>} />
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {col("Date", "transacted_at", txnActions, txnList)} <th style={th}>Item</th>
                {col("Type", "type", txnActions, txnList)} {col("Qty", "quantity", txnActions, txnList)}
                <th style={th}>By</th> <th style={th}>Notes</th>
              </tr></thead>
              <tbody>
                {txns?.data?.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={td}>{new Date(t.transacted_at).toLocaleDateString("en-IN")}</td>
                    <td style={td}>{t.paper_name || t.item_name || "—"}</td>
                    <td style={td}><span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 12, background: t.type === "in" ? "#d3f9d8" : "#ffe3e3", color: t.type === "in" ? "#2b8a3e" : "#c92a2a" }}>{t.type}</span></td>
                    <td style={{ ...td, fontWeight: 600 }}>{t.quantity}</td>
                    <td style={td}>{t.performed_by_name}</td>
                    <td style={{ ...td, color: "#888" }}>{t.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {txns && <Pagination page={txns.page} totalPages={txns.totalPages} total={txns.total} limit={txns.limit} onPage={txnActions.setPage} />}
        </>
      )}
    </div>
  );
}
