import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";

type Tab = "paper" | "items" | "transactions";
const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14 };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["paper"] }); qc.invalidateQueries({ queryKey: ["inv-items"] }); qc.invalidateQueries({ queryKey: ["inv-txns"] }); onClose(); },
  });
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <h3 style={{ marginBottom: 16 }}>Record Transaction — {target.name}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label><span style={{ fontSize: 13 }}>Type</span>
          <select style={inputStyle} value={form.type} onChange={set("type")}>
            <option value="in">Stock In (Purchase)</option><option value="out">Stock Out</option>
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

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("paper");
  const [txnTarget, setTxnTarget] = useState<{ id: string; isPaper: boolean; name: string } | null>(null);

  const [paperList, paperActions] = useListState({ sortBy: "name" });
  const [itemList, itemActions] = useListState({ sortBy: "name" });
  const [txnList, txnActions] = useListState({ sortBy: "transacted_at" });

  const { data: paper } = useQuery({ queryKey: ["paper", paperActions.toParams()], queryFn: () => api.get("/admin/inventory/paper", { params: paperActions.toParams() }).then(r => r.data), keepPreviousData: true });
  const { data: items } = useQuery({ queryKey: ["inv-items", itemActions.toParams()], queryFn: () => api.get("/admin/inventory/items", { params: itemActions.toParams() }).then(r => r.data), keepPreviousData: true });
  const { data: txns } = useQuery({ queryKey: ["inv-txns", txnActions.toParams()], queryFn: () => api.get("/admin/inventory/transactions", { params: txnActions.toParams() }).then(r => r.data), keepPreviousData: true });

  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: tab === t ? "#3b5bdb" : "#eee", color: tab === t ? "#fff" : "#444", fontWeight: 600, cursor: "pointer" }}>{label}</button>
  );

  const col = (label: string, key: string, actions: ReturnType<typeof useListState>[1], list: ReturnType<typeof useListState>[0]) => (
    <th style={th} onClick={() => actions.setSort(key)}>{label}<SortIcon col={key} sortBy={list.sortBy} sortDir={list.sortDir} /></th>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Inventory</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>{tabBtn("paper", "Paper Stock")}{tabBtn("items", "Ink / Plates")}{tabBtn("transactions", "Transactions")}</div>

      {txnTarget && <TxnForm target={txnTarget} onClose={() => setTxnTarget(null)} />}

      {tab === "paper" && (
        <>
          <TableControls search={paperList.search} onSearch={paperActions.setSearch} placeholder="Search paper…"
            activeFilters={paperList.filters} onFilter={paperActions.setFilter} onReset={paperActions.resetFilters}
            filters={[
              { key: "isLow", label: "Low Stock", options: [{ label: "Low only", value: "1" }] },
              { key: "type", label: "Type", options: [{ label: "Art Paper", value: "art" }, { label: "Maplitho", value: "maplitho" }, { label: "Bond", value: "bond" }] },
            ]} />
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {col("Name", "name", paperActions, paperList)} {col("Brand", "brand", paperActions, paperList)}
                {col("GSM", "gsm", paperActions, paperList)} <th style={th}>Size</th>
                {col("Stock", "quantity", paperActions, paperList)} <th style={th}>Threshold</th> <th style={th} />
              </tr></thead>
              <tbody>
                {paper?.data?.map((p: Record<string, unknown>) => (
                  <tr key={p.id as string} style={{ borderBottom: "1px solid #f0f0f0", background: p.is_low ? "#fff9f9" : "#fff" }}>
                    <td style={{ ...td, fontWeight: 500 }}>{p.name as string}</td>
                    <td style={td}>{(p.brand as string) || "—"}</td>
                    <td style={td}>{(p.gsm as string) || "—"}</td>
                    <td style={td}>{(p.size as string) || "—"}</td>
                    <td style={td}><StockBadge isLow={p.is_low as boolean} qty={p.quantity as number} unit={p.unit as string} /></td>
                    <td style={{ ...td, color: "#888" }}>{p.low_stock_threshold as number} {p.unit as string}</td>
                    <td style={td}><button onClick={() => setTxnTarget({ id: p.id as string, isPaper: true, name: p.name as string })} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }}>+ Stock</button></td>
                  </tr>
                ))}
                {!paper?.data?.length && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>No paper stock</td></tr>}
              </tbody>
            </table>
          </div>
          {paper && <Pagination page={paper.page} totalPages={paper.totalPages} total={paper.total} limit={paper.limit} onPage={paperActions.setPage} />}
        </>
      )}

      {tab === "items" && (
        <>
          <TableControls search={itemList.search} onSearch={itemActions.setSearch} placeholder="Search items…"
            activeFilters={itemList.filters} onFilter={itemActions.setFilter} onReset={itemActions.resetFilters}
            filters={[
              { key: "category", label: "Category", options: [{ label: "Ink", value: "ink" }, { label: "Plate", value: "plate" }, { label: "Consumable", value: "consumable" }, { label: "Other", value: "other" }] },
              { key: "isLow", label: "Low Stock", options: [{ label: "Low only", value: "1" }] },
            ]} />
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {col("Name", "name", itemActions, itemList)} {col("Category", "category", itemActions, itemList)}
                {col("Stock", "quantity", itemActions, itemList)} <th style={th}>Threshold</th> <th style={th} />
              </tr></thead>
              <tbody>
                {items?.data?.map((i: Record<string, unknown>) => (
                  <tr key={i.id as string} style={{ borderBottom: "1px solid #f0f0f0", background: i.is_low ? "#fff9f9" : "#fff" }}>
                    <td style={{ ...td, fontWeight: 500 }}>{i.name as string}</td>
                    <td style={td}>{i.category as string}</td>
                    <td style={td}><StockBadge isLow={i.is_low as boolean} qty={i.quantity as number} unit={i.unit as string} /></td>
                    <td style={{ ...td, color: "#888" }}>{i.low_stock_threshold as number} {i.unit as string}</td>
                    <td style={td}><button onClick={() => setTxnTarget({ id: i.id as string, isPaper: false, name: i.name as string })} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "#fff" }}>+ Stock</button></td>
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
          <TableControls search={txnList.search} onSearch={txnActions.setSearch} placeholder="Search notes, PO ref…"
            activeFilters={txnList.filters} onFilter={txnActions.setFilter} onReset={txnActions.resetFilters}
            filters={[{ key: "type", label: "Type", options: [{ label: "In", value: "in" }, { label: "Out", value: "out" }, { label: "Wastage", value: "wastage" }, { label: "Adjustment", value: "adjustment" }] }]} />
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
                {col("Date", "transacted_at", txnActions, txnList)} <th style={th}>Item</th>
                {col("Type", "type", txnActions, txnList)} {col("Qty", "quantity", txnActions, txnList)}
                <th style={th}>By</th> <th style={th}>Notes</th>
              </tr></thead>
              <tbody>
                {txns?.data?.map((t: Record<string, string>) => (
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
