import { useEffect } from "react";
import { fmtDate } from "../lib/fmtDate.ts";

interface JobPaper { paper_name?: string; gsm?: number; size?: string; sheet_count: number; unit?: string; paper_cost?: number; }

interface Job {
  id: string; job_number: number; title: string; client_name: string; client_company_name: string; client_phone: string; created_at?: string; machine_id: string;
  status: string; quantity: number; due_date: string; order_type: string; job_type: string; description?: string;
  machine_name?: string;
  papers?: JobPaper[];
  paper_type: string; paper_gsm: number; sheet_size: string; sheet_count: number;
  composing_date: string; composing_amount: number; plate_cost: number; die_cost: number;
  plate_source: string; approved_rate: number; hela_cost: number; other_cost: number;
  proof_required: boolean;
  is_offset: boolean; is_digital: boolean; is_screen: boolean;
  print_colors: string; print_operator: string; print_operator_name?: string; print_date: string;
  is_numbering: boolean; numbering_from: number; numbering_to: number;
  is_binding: boolean; is_uv: boolean; is_foil: boolean; is_die_cutting: boolean;
  is_half_cutting: boolean; is_creasing: boolean; is_pasting: boolean;
  is_lamination: boolean; lamination_type?: string; is_folding: boolean; is_gumming: boolean;
  post_print_date: string; binding_operator: string; packing_operator: string;
  advance_amount: number; quoted_price: number; quotation_ref: string; indent_number: string;
  delivery_quantity: number; challan_number: string; challan_date: string;
  tax_invoice_no?: string; invoice_date?: string;
}

interface PrintTemplate { header: string | null; footer: string | null; signature: string | null; printFontSize?: number; }

export default function JobPrintView({ job, template, onClose }: { job: Job; template: PrintTemplate; onClose: () => void }) {
  const fs = template.printFontSize ?? 11;        // base font size
  const fsLabel = Math.max(7, fs - 1);            // field labels, table headers
  const fsTiny  = Math.max(7, fs - 2);            // "Client", "Due Date" box headers
  const fsTitle = fs + 7;                         // "JOB CARD"
  const fsJobNum = fs + 11;                       // "#41"
  const fsBoxValue = fs + 2;                      // client name, due date value
  const fsBoxSub = Math.max(7, fs - 1);           // client sub-line, phone

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "print-hide";
    style.textContent = `@media print { .no-print { display: none !important; } body { margin: 0; } .print-content { font-size: ${fs}px !important; } }`;
    document.head.appendChild(style);
    return () => { document.getElementById("print-hide")?.remove(); };
  }, [fs]);

  const fmt = (n: number | null | undefined) => n ? "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—";

  const cell = (label: string, value: string | number | boolean | null | undefined) => (
    <div style={{ padding: "3px 6px", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ fontSize: fsLabel, color: "#6b7280", marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: fs, fontWeight: 500, color: "#1f2937" }}>
        {value != null && value !== "" && value !== false ? String(value) : "—"}
      </div>
    </div>
  );

  const section = (title: string) => (
    <div style={{ gridColumn: "1 / -1", background: "#f9fafb", padding: "4px 6px", fontSize: fsLabel, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.5px", borderTop: "2px solid #e5e7eb" }}>
      {title}
    </div>
  );

  const finishingItems = [
    job.is_offset && "Offset", job.is_digital && "Digital", job.is_screen && "Screen",
    job.is_numbering && ("Numbering (" + (job.numbering_from || "") + "–" + (job.numbering_to || "") + ")"),
    job.is_binding && "Binding", job.is_uv && "UV", job.is_foil && "Foil",
    job.is_die_cutting && "Die Cutting", job.is_half_cutting && "Half Cutting",
    job.is_creasing && "Creasing", job.is_pasting && "Pasting",
    job.is_lamination && ("Lamination" + (job.lamination_type ? ` (${job.lamination_type.charAt(0).toUpperCase() + job.lamination_type.slice(1)})` : "")), job.is_folding && "Folding", job.is_gumming && "Gumming",
  ].filter(Boolean).join(", ");

  const balance = (Number(job.quoted_price) || 0) - (Number(job.advance_amount) || 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, overflowY: "auto" }}>
      <div className="no-print" style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1 }}>
        <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500 }}>{"✕"} Close</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Job Card #{job.job_number} — Print Preview</span>
        <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Print</button>
      </div>

      <div
        className="print-content"
        style={{
          maxWidth: 800, margin: "12px auto", background: "#fff",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)", borderRadius: 8, overflow: "hidden",
          fontSize: `${fs}px`,
          // @ts-ignore CSS custom property
          "--print-font-size": `${fs}px`,
        }}
      >
        {template.header && <img src={template.header} alt="Header" style={{ width: "100%", display: "block" }} />}

        <div style={{ padding: "6px 8px 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #7c3aed" }}>
            <div>
              <div style={{ fontSize: fsTitle, fontWeight: 900, color: "#7c3aed", letterSpacing: "-0.5px" }}>JOB CARD</div>
              <div style={{ fontSize: fsLabel, color: "#6b7280", marginTop: 1 }}>Created: {fmtDate(job.created_at ?? new Date().toISOString())}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: fsJobNum, fontWeight: 900, color: "#1f2937" }}>#{job.job_number}</div>
              <span style={{ fontSize: fsLabel, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#ede9fe", color: "#6d28d9" }}>{job.status?.toUpperCase()}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div style={{ background: "#f9fafb", borderRadius: 6, padding: "6px 8px" }}>
              <div style={{ fontSize: fsTiny, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 }}>Client</div>
              <div style={{ fontSize: fsBoxValue, fontWeight: 700 }}>{job.client_company_name || job.client_name || "—"}</div>
              {job.client_name && <div style={{ fontSize: fsBoxSub, color: "#6b7280", marginTop: 1 }}>{job.client_name}</div>}
              {job.client_phone && <div style={{ fontSize: fsBoxSub, fontWeight: 700, color: "#6b7280", marginTop: 1 }}>📞 {job.client_phone}</div>}
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 6, padding: "6px 8px" }}>
              <div style={{ fontSize: fsTiny, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 }}>Due Date</div>
              <div style={{ fontSize: fsBoxValue, fontWeight: 700 }}>{fmtDate(job.due_date)}</div>
            </div>
          </div>

          {/* 2-column info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
            {section("Basic Information")}
            {cell("Company Name", job.client_company_name || job.client_name)}
            {cell("Contact No", job.client_phone)}
            {cell("Created Date", fmtDate(job.created_at))}
            {cell("Job Title", job.job_type)}
            {cell("Order Type", job.order_type)}
            {cell("Quantity", job.quantity ? (job.quantity + " PCS") : "—")}
            {job.description ? <div style={{ gridColumn: "1 / -1", padding: "3px 6px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: fsLabel, color: "#6b7280", marginBottom: 1 }}>Description</div>
              <div style={{ fontSize: fs, fontWeight: 500, color: "#1f2937" }}>{job.description}</div>
            </div> : null}

            {section("Paper & Machine")}
            {cell("Machine", job.machine_name)}
            {cell("Sheet Size", job.sheet_size)}
            <div style={{ gridColumn: "1 / -1", padding: "4px 6px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: fsLabel, color: "#6b7280", marginBottom: 4 }}>Papers Used</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ textAlign: "left", padding: "3px 8px", border: "1px solid #e5e7eb", fontSize: fsLabel, fontWeight: 700, color: "#6b7280" }}>#</th>
                    <th style={{ textAlign: "left", padding: "3px 8px", border: "1px solid #e5e7eb", fontSize: fsLabel, fontWeight: 700, color: "#6b7280" }}>Paper</th>
                    <th style={{ textAlign: "left", padding: "3px 8px", border: "1px solid #e5e7eb", fontSize: fsLabel, fontWeight: 700, color: "#6b7280" }}>GSM</th>
                    <th style={{ textAlign: "right", padding: "3px 8px", border: "1px solid #e5e7eb", fontSize: fsLabel, fontWeight: 700, color: "#6b7280" }}>Sheets</th>
                    <th style={{ textAlign: "right", padding: "3px 8px", border: "1px solid #e5e7eb", fontSize: fsLabel, fontWeight: 700, color: "#6b7280" }}>Cost (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(job.papers && job.papers.length > 0 ? job.papers : [{ paper_name: job.paper_type, gsm: job.paper_gsm, sheet_count: job.sheet_count }]).map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", color: "#6b7280" }}>{i + 1}</td>
                      <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", fontWeight: 600 }}>{p.paper_name || "—"}</td>
                      <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb" }}>{p.gsm ? p.gsm + " GSM" : "—"}</td>
                      <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", textAlign: "right" }}>{p.sheet_count ? String(p.sheet_count) + (p.unit ? " " + p.unit : "") : "—"}</td>
                      <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", textAlign: "right" }}>{p.paper_cost != null ? "₹" + Number(p.paper_cost).toLocaleString("en-IN") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {section("Pre-Print Process")}
            {cell("Composing Date", fmtDate(job.composing_date))}
            {cell("Composing Amount", fmt(job.composing_amount))}
            {cell("Plate Cost", fmt(job.plate_cost))}
            {cell("Die Cost", fmt(job.die_cost))}
            {cell("Plate Source", job.plate_source)}
            {cell("Approved Rate", fmt(job.approved_rate))}
            {cell("Hela Cost", fmt(job.hela_cost))}
            {cell("Other Cost", fmt(job.other_cost))}
            {cell("Proof Required", job.proof_required ? "Yes" : "No")}
            <div style={{ padding: "3px 6px", borderBottom: "1px solid #f3f4f6" }} />

            {section("Print Process")}
            {cell("Print Type", [job.is_offset && "Offset", job.is_digital && "Digital", job.is_screen && "Screen"].filter(Boolean).join(", ") || "—")}
            {cell("Print Colors", job.print_colors)}
            {cell("Print Operator", job.print_operator_name || job.print_operator)}
            {cell("Print Date", fmtDate(job.print_date))}

            {section("Post-Print Process")}
            {cell("Finishing", finishingItems || "None")}
            {cell("Binding Operator", job.binding_operator)}
            {cell("Packing Operator", job.packing_operator)}
            {cell("Post-Print Date", fmtDate(job.post_print_date))}

            {section("Financial & Delivery")}
            {cell("Quoted Price", fmt(job.quoted_price))}
            {cell("Advance Amount", fmt(job.advance_amount))}
            {cell("Balance Due", fmt(balance))}
            {cell("Quotation Ref", job.quotation_ref)}
            {cell("Indent Number", job.indent_number)}
            {cell("Delivery Quantity", job.delivery_quantity)}
            {cell("Challan Number", job.challan_number)}
            {cell("Challan Date", fmtDate(job.challan_date))}
            {cell("Tax Invoice No", job.tax_invoice_no)}
            {cell("Invoice Date", fmtDate(job.invoice_date))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, paddingTop: 6, borderTop: "1px solid #e5e7eb" }}>
            <div style={{ textAlign: "center" }}>
              {template.signature && <img src={template.signature} alt="Signature" style={{ maxWidth: 160, maxHeight: 64, display: "block", marginBottom: 4 }} />}
              <div style={{ width: 180, borderTop: "1px solid #374151", paddingTop: 4, fontSize: fs, color: "#6b7280", fontWeight: 600 }}>Authorised Signatory</div>
            </div>
          </div>
        </div>

        {template.footer && <img src={template.footer} alt="Footer" style={{ width: "100%", display: "block" }} />}
      </div>
    </div>
  );
}
