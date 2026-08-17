import { useEffect } from "react";
import { fmtDate } from "../lib/fmtDate.ts";

interface LineItem { description: string; qty: number; rate: number; amount: number; }
interface Invoice {
  id: string; invoice_number: number; client_name: string; client_id: string;
  job_id: string; total: number; amount_paid: number; balance_due: number;
  status: string; due_date: string; issue_date: string; notes: string;
  gst_percent: number; discount_amount: number; line_items: LineItem[];
}
interface PrintTemplate { header: string | null; footer: string | null; signature: string | null; }

const STATUS_COLOR: Record<string, string> = {
  draft: "#868e96", issued: "#1971c2", partially_paid: "#f59f00", paid: "#2b8a3e", cancelled: "#c92a2a",
};

export default function InvoicePrintView({ invoice, template, onClose }: { invoice: Invoice; template: PrintTemplate; onClose: () => void }) {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "invoice-print-hide";
    style.textContent = "@media print { .no-print { display: none !important; } body { margin: 0; } }";
    document.head.appendChild(style);
    return () => { document.getElementById("invoice-print-hide")?.remove(); };
  }, []);

  const fmt = (n: number | string | null | undefined) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const lines: LineItem[] = invoice.line_items ?? [];
  const subtotalRaw = lines.reduce((s, l) => s + Number(l.amount), 0);
  const discount = Number(invoice.discount_amount) || 0;
  const subtotal = subtotalRaw - discount;
  const gstAmt = subtotal * (Number(invoice.gst_percent) || 0) / 100;
  const total = subtotal + gstAmt;
  const statusColor = STATUS_COLOR[invoice.status] ?? "#868e96";

  const thStyle: React.CSSProperties = { padding: "9px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", background: "#f9fafb", borderBottom: "2px solid #e5e7eb" };
  const tdStyle: React.CSSProperties = { padding: "9px 12px", fontSize: 13, borderBottom: "1px solid #f3f4f6" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, overflowY: "auto" }}>
      <div className="no-print" style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1 }}>
        <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500 }}>{"✕"} Close</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Invoice #{invoice.invoice_number} — Print Preview</span>
        <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "#1971c2", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Print</button>
      </div>

      <div style={{ maxWidth: 800, margin: "24px auto", background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", borderRadius: 8, overflow: "hidden" }}>
        {template.header && <img src={template.header} alt="Header" style={{ width: "100%", display: "block" }} />}

        <div style={{ padding: "24px 28px" }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #1971c2" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#1971c2", letterSpacing: "-0.5px" }}>TAX INVOICE</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Issue Date: {fmtDate(invoice.issue_date)}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Due Date: {fmtDate(invoice.due_date)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#1f2937" }}>#{String(invoice.invoice_number).padStart(4, "0")}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: statusColor + "22", color: statusColor }}>{invoice.status?.toUpperCase()}</span>
            </div>
          </div>

          {/* Bill To */}
          <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "inline-block", minWidth: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>Bill To</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1f2937" }}>{invoice.client_name || "—"}</div>
          </div>

          {/* Line items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: "50%" }}>Description</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Rate</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>No line items</td></tr>
              )}
              {lines.map((l, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{l.description || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{l.qty}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(l.rate)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{fmt(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
            <table style={{ borderCollapse: "collapse", minWidth: 280 }}>
              <tbody>
                <tr>
                  <td style={{ padding: "5px 12px", fontSize: 13, color: "#6b7280", textAlign: "right" }}>Subtotal</td>
                  <td style={{ padding: "5px 12px", fontSize: 13, fontWeight: 600, textAlign: "right", minWidth: 100 }}>{fmt(subtotalRaw)}</td>
                </tr>
                {discount > 0 && (
                  <tr>
                    <td style={{ padding: "5px 12px", fontSize: 13, color: "#6b7280", textAlign: "right" }}>Discount</td>
                    <td style={{ padding: "5px 12px", fontSize: 13, fontWeight: 600, textAlign: "right", color: "#c92a2a" }}>-{fmt(discount)}</td>
                  </tr>
                )}
                {Number(invoice.gst_percent) > 0 && (
                  <tr>
                    <td style={{ padding: "5px 12px", fontSize: 13, color: "#6b7280", textAlign: "right" }}>GST ({invoice.gst_percent}%)</td>
                    <td style={{ padding: "5px 12px", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{fmt(gstAmt)}</td>
                  </tr>
                )}
                <tr style={{ borderTop: "2px solid #1f2937" }}>
                  <td style={{ padding: "8px 12px", fontSize: 15, fontWeight: 800, textAlign: "right" }}>Total</td>
                  <td style={{ padding: "8px 12px", fontSize: 15, fontWeight: 800, textAlign: "right", color: "#1971c2" }}>{fmt(total)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "5px 12px", fontSize: 13, color: "#6b7280", textAlign: "right" }}>Paid</td>
                  <td style={{ padding: "5px 12px", fontSize: 13, fontWeight: 600, textAlign: "right", color: "#2b8a3e" }}>{fmt(invoice.amount_paid)}</td>
                </tr>
                <tr style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "6px 12px", fontSize: 14, fontWeight: 700, textAlign: "right" }}>Balance Due</td>
                  <td style={{ padding: "6px 12px", fontSize: 14, fontWeight: 700, textAlign: "right", color: Number(invoice.balance_due) > 0 ? "#c92a2a" : "#2b8a3e" }}>{fmt(invoice.balance_due)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#374151" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
              {invoice.notes}
            </div>
          )}

          {/* Signature */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
            <div style={{ textAlign: "center" }}>
              {template.signature && <img src={template.signature} alt="Signature" style={{ maxWidth: 160, maxHeight: 64, display: "block", marginBottom: 4 }} />}
              <div style={{ width: 180, borderTop: "1px solid #374151", paddingTop: 4, fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Authorised Signatory</div>
            </div>
          </div>
        </div>

        {template.footer && <img src={template.footer} alt="Footer" style={{ width: "100%", display: "block" }} />}
      </div>
    </div>
  );
}
