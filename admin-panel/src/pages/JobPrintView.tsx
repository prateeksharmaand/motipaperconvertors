import { useEffect } from "react";

interface Job {
  id: string; job_number: number; title: string; client_name: string; client_company_name?: string; client_phone?: string; created_at?: string; machine_id: string;
  status: string; quantity: number; due_date: string; order_type: string; job_type: string;
  paper_type: string; paper_gsm: number; sheet_size: string; sheet_count: number;
  composing_date: string; composing_amount: number; plate_cost: number; die_cost: number;
  plate_source: string; approved_rate: number; hela_cost: number; other_cost: number;
  proof_required: boolean;
  is_offset: boolean; is_digital: boolean; is_screen: boolean;
  print_colors: string; print_operator: string; print_date: string;
  is_numbering: boolean; numbering_from: number; numbering_to: number;
  is_binding: boolean; is_uv: boolean; is_foil: boolean; is_die_cutting: boolean;
  is_half_cutting: boolean; is_creasing: boolean; is_pasting: boolean;
  is_lamination: boolean; is_folding: boolean; is_gumming: boolean;
  post_print_date: string; binding_operator: string; packing_operator: string;
  advance_amount: number; quoted_price: number; quotation_ref: string; indent_number: string;
  delivery_quantity: number; challan_number: string; challan_date: string;
}

interface PrintTemplate { header: string | null; footer: string | null; signature: string | null; }

export default function JobPrintView({ job, template, onClose }: { job: Job; template: PrintTemplate; onClose: () => void }) {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "print-hide";
    style.textContent = "@media print { .no-print { display: none !important; } body { margin: 0; } }";
    document.head.appendChild(style);
    return () => { document.getElementById("print-hide")?.remove(); };
  }, []);

  const fmt = (n: number | null | undefined) => n ? "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—";
  const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString("en-IN") : "—";
  const row = (label: string, value: string | number | boolean | null | undefined) => (
    <tr>
      <td style={{ padding: "5px 10px", fontSize: 12, color: "#6b7280", width: "30%", borderBottom: "1px solid #f3f4f6" }}>{label}</td>
      <td style={{ padding: "5px 10px", fontSize: 13, fontWeight: 500, borderBottom: "1px solid #f3f4f6" }}>{value || "—"}</td>
    </tr>
  );
  const section = (title: string) => (
    <tr><td colSpan={2} style={{ background: "#f9fafb", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.5px", borderTop: "2px solid #e5e7eb" }}>{title}</td></tr>
  );

  const finishingItems = [
    job.is_offset && "Offset", job.is_digital && "Digital", job.is_screen && "Screen",
    job.is_numbering && ("Numbering (" + (job.numbering_from || "") + "–" + (job.numbering_to || "") + ")"),
    job.is_binding && "Binding", job.is_uv && "UV", job.is_foil && "Foil",
    job.is_die_cutting && "Die Cutting", job.is_half_cutting && "Half Cutting",
    job.is_creasing && "Creasing", job.is_pasting && "Pasting",
    job.is_lamination && "Lamination", job.is_folding && "Folding", job.is_gumming && "Gumming",
  ].filter(Boolean).join(", ");

  const balance = (Number(job.quoted_price) || 0) - (Number(job.advance_amount) || 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, overflowY: "auto" }}>
      <div className="no-print" style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1 }}>
        <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500 }}>{"✕"} Close</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Job Card #{job.job_number} — Print Preview</span>
        <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Print</button>
      </div>

      <div style={{ maxWidth: 800, margin: "24px auto", background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", borderRadius: 8, overflow: "hidden" }}>
        {template.header && <img src={template.header} alt="Header" style={{ width: "100%", display: "block" }} />}

        <div style={{ padding: "20px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #7c3aed" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#7c3aed", letterSpacing: "-0.5px" }}>JOB CARD</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Created: {fmtDate(job.created_at ?? new Date().toISOString())}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#1f2937" }}>#{job.job_number}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: "#ede9fe", color: "#6d28d9" }}>{job.status?.toUpperCase()}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>Client</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{job.client_company_name || job.client_name || "—"}</div>
              {job.client_name && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{job.client_name}</div>}
              {job.client_phone && <div style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", marginTop: 1 }}>📞 {job.client_phone}</div>}
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>Due Date</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtDate(job.due_date)}</div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {section("Basic Information")}
              {row("Created Date", fmtDate(job.created_at))}
              {row("Job Title", job.job_type)}
              {row("Order Type", job.order_type)}
              {row("Quantity", job.quantity ? (job.quantity + " PCS") : "—")}
              {section("Paper & Machine")}
              {row("Paper Type", job.paper_type)}
              {row("Paper GSM", job.paper_gsm ? (job.paper_gsm + " GSM") : "—")}
              {row("Sheet Size", job.sheet_size)}
              {row("Sheet Count", job.sheet_count)}
              {section("Pre-Print Process")}
              {row("Composing Date", fmtDate(job.composing_date))}
              {row("Composing Amount", fmt(job.composing_amount))}
              {row("Plate Cost", fmt(job.plate_cost))}
              {row("Die Cost", fmt(job.die_cost))}
              {row("Plate Source", job.plate_source)}
              {row("Approved Rate", fmt(job.approved_rate))}
              {row("Hela Cost", fmt(job.hela_cost))}
              {row("Other Cost", fmt(job.other_cost))}
              {row("Proof Required", job.proof_required ? "Yes" : "No")}
              {section("Print Process")}
              {row("Print Type", [job.is_offset && "Offset", job.is_digital && "Digital", job.is_screen && "Screen"].filter(Boolean).join(", ") || "—")}
              {row("Print Colors", job.print_colors)}
              {row("Print Operator", job.print_operator)}
              {row("Print Date", fmtDate(job.print_date))}
              {section("Post-Print Process")}
              {row("Finishing", finishingItems || "None")}
              {row("Binding Operator", job.binding_operator)}
              {row("Packing Operator", job.packing_operator)}
              {row("Post-Print Date", fmtDate(job.post_print_date))}
              {section("Financial & Delivery")}
              {row("Quoted Price", fmt(job.quoted_price))}
              {row("Advance Amount", fmt(job.advance_amount))}
              {row("Balance Due", fmt(balance))}
              {row("Quotation Ref", job.quotation_ref)}
              {row("Indent Number", job.indent_number)}
              {row("Delivery Quantity", job.delivery_quantity)}
              {row("Challan Number", job.challan_number)}
              {row("Challan Date", fmtDate(job.challan_date))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
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
