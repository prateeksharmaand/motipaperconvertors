import { toast } from "sonner";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useAuthStore } from "../store/auth.ts";

const STORAGE_KEY = () => {
  const tenantId = useAuthStore.getState().tenantId ?? "default";
  return `paper_rate_date_${tenantId}`;
};

export function shouldShowPaperRateToday(): boolean {
  const key = STORAGE_KEY();
  const last = localStorage.getItem(key);
  const today = new Date().toISOString().slice(0, 10);
  return last !== today;
}

export function markPaperRateShownToday() {
  localStorage.setItem(STORAGE_KEY(), new Date().toISOString().slice(0, 10));
}

type PaperItem = {
  id: string; name: string; brand: string; gsm: number;
  size: string; unit: string; quantity: number; cost_per_unit: number | null;
};

type RateRow = { id: string; name: string; gsm: number; size: string; unit: string; quantity: number; costPerUnit: string; ratePerReem: string; };

const inputStyle: React.CSSProperties = {
  padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6,
  fontSize: 13, width: "100%", boxSizing: "border-box" as const,
};

interface Props { onClose: () => void; }

export default function PaperRateModal({ onClose }: Props) {
  const qc = useQueryClient();
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const { data: paperData, isLoading } = useQuery({
    queryKey: ["paper-rate-all"],
    queryFn: () => api.get("/admin/inventory/paper", { params: { limit: 200 } }).then(r => r.data.data ?? []),
  });

  const papers: PaperItem[] = paperData ?? [];

  const [rates, setRates] = useState<Record<string, RateRow>>({});

  // Init rows when data loads
  const getRow = (p: PaperItem): RateRow =>
    rates[p.id] ?? {
      id: p.id, name: p.name, gsm: p.gsm, size: p.size, unit: p.unit,
      quantity: p.quantity,
      costPerUnit: p.cost_per_unit != null ? String(p.cost_per_unit) : "",
      ratePerReem: "",
    };

  const setField = (id: string, field: "costPerUnit" | "ratePerReem", value: string) => {
    setRates(prev => {
      const paper = papers.find(p => p.id === id)!;
      const existing = prev[id] ?? getRow(paper);
      return { ...prev, [id]: { ...existing, [field]: value } };
    });
  };

  const save = useMutation({
    mutationFn: () => {
      const toUpdate = papers.map(p => {
        const row = getRow(p);
        const cost = row.costPerUnit ? Number(row.costPerUnit) : (p.cost_per_unit ?? 0);
        return { id: p.id, costPerUnit: cost };
      }).filter(r => r.costPerUnit > 0);
      return api.post("/admin/inventory/paper-rates", { rates: toUpdate });
    },
    onSuccess: () => {
      markPaperRateShownToday();
      qc.invalidateQueries({ queryKey: ["paper"] });
      toast.success("Paper rates updated");
      onClose();
    },
    onError: () => toast.error("Failed to update paper rates"),
  });

  const handleSkip = () => { markPaperRateShownToday(); onClose(); };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "100%", maxWidth: 860,
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>📋 Daily Paper Rates</h2>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{today}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSkip} style={{ padding: "7px 16px", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, color: "#6b7280" }}>
                Skip for Today
              </button>
              <button onClick={() => save.mutate()} disabled={save.isPending} style={{ padding: "7px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                {save.isPending ? "Saving…" : "Save Rates"}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "8px 12px", background: "#fef9f0", borderRadius: 6, border: "1px solid #fde68a", fontSize: 12, color: "#92400e" }}>
            Enter today's paper rates below. Rate per Ream auto-calculates the cost per unit. These rates update your inventory cost records.
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 28px 24px" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Loading paper stock…</div>
          ) : papers.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>No paper stock found. Add paper in Inventory first.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  {["Paper Name", "Size", "GSM", "Stock (Sheets)", "Rate / Ream (Rs.)", "Cost / Unit (Rs.)", "Total Cost (Rs.)"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {papers.map((p, i) => {
                  const row = getRow(p);
                  const costPerUnit = row.costPerUnit ? Number(row.costPerUnit) : 0;
                  const ratePerReem = row.ratePerReem ? Number(row.ratePerReem) : 0;
                  // 1 ream = 500 sheets typically; derive cost_per_unit from rate_per_reem
                  const derivedCost = ratePerReem > 0 ? (ratePerReem / 500) : costPerUnit;
                  const totalCost = derivedCost > 0 ? Math.round(p.quantity * derivedCost) : 0;

                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{p.name}</div>
                        {p.brand && <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.brand}</div>}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>{p.size || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>{p.gsm ? `${p.gsm} GSM` : "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#1f2937" }}>
                        {Number(p.quantity).toLocaleString("en-IN")} {p.unit}
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="e.g. 850"
                          value={row.ratePerReem}
                          onChange={e => {
                            const val = e.target.value;
                            setField(p.id, "ratePerReem", val);
                            // auto-derive cost per unit (1 ream = 500 sheets)
                            if (val) setField(p.id, "costPerUnit", String((Number(val) / 500).toFixed(4)));
                          }}
                          style={inputStyle}
                        />
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <input
                          type="number"
                          min={0}
                          step="0.0001"
                          placeholder="auto"
                          value={row.costPerUnit}
                          onChange={e => setField(p.id, "costPerUnit", e.target.value)}
                          style={{ ...inputStyle, background: row.ratePerReem ? "#f0fdf4" : "#fff" }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: totalCost > 0 ? "#7c3aed" : "#9ca3af" }}>
                        {totalCost > 0 ? `Rs.${totalCost.toLocaleString("en-IN")}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Grand Total */}
              {papers.length > 0 && (() => {
                const grand = papers.reduce((sum, p) => {
                  const row = getRow(p);
                  const ratePerReem = row.ratePerReem ? Number(row.ratePerReem) : 0;
                  const costPerUnit = row.costPerUnit ? Number(row.costPerUnit) : 0;
                  const derived = ratePerReem > 0 ? (ratePerReem / 500) : costPerUnit;
                  return sum + (derived > 0 ? p.quantity * derived : 0);
                }, 0);
                return grand > 0 ? (
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f5f3ff" }}>
                      <td colSpan={6} style={{ padding: "12px", fontWeight: 700, fontSize: 14, color: "#7c3aed", textAlign: "right" }}>Grand Total Paper Cost</td>
                      <td style={{ padding: "12px", fontWeight: 800, fontSize: 15, color: "#7c3aed" }}>Rs.{Math.round(grand).toLocaleString("en-IN")}</td>
                    </tr>
                  </tfoot>
                ) : null;
              })()}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
