import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";

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

type Job = {
  id: string; job_number: number; title: string; client_name: string; client_id: string;
  machine_id: string; status: string; due_date: string; quoted_price: number;
  operator_name: string; description: string; job_type: string; size: string; quantity: number;
  order_type: string; sheet_size: string; sheet_count: number; paper_gsm: number;
  paper_type: string;
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
  advance_amount: number; quotation_ref: string; indent_number: string;
  delivery_quantity: number; challan_number: string; challan_date: string;
};

interface Client { id: string; name: string; }
interface Machine { id: string; name: string; }

const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14, boxSizing: "border-box" };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

const sectionStyle: React.CSSProperties = { marginBottom: 24 };
const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "#3b5bdb", textTransform: "uppercase",
  letterSpacing: "0.06em", marginBottom: 12, paddingBottom: 6,
  borderBottom: "2px solid #e7ecff",
};
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const labelStyle: React.CSSProperties = { fontSize: 13, color: "#444", display: "flex", flexDirection: "column", gap: 4 };
const checkRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" };

type FormState = Record<string, string | boolean>;

function boolField(form: FormState, key: string): boolean {
  const v = form[key];
  return v === true || v === "true";
}

function buildApiPayload(form: FormState) {
  const num = (k: string) => form[k] !== "" && form[k] !== undefined ? Number(form[k]) : undefined;
  const str = (k: string) => (form[k] as string) || undefined;
  const bool = (k: string) => boolField(form, k);
  return {
    clientId: str("client_id"),
    title: form.title as string,
    jobType: str("job_type"),
    description: str("description"),
    quantity: num("quantity"),
    size: str("size"),
    paperType: str("paper_type"),
    dueDate: str("due_date"),
    machineId: str("machine_id") || undefined,
    quotedPrice: num("quoted_price"),
    orderType: str("order_type") || "in_house",
    sheetSize: str("sheet_size"),
    sheetCount: num("sheet_count"),
    paperGsm: num("paper_gsm"),
    composingDate: str("composing_date"),
    composingAmount: num("composing_amount"),
    plateCost: num("plate_cost"),
    dieCost: num("die_cost"),
    plateSource: str("plate_source"),
    approvedRate: num("approved_rate"),
    helaCost: num("hela_cost"),
    otherCost: num("other_cost"),
    proofRequired: bool("proof_required"),
    isOffset: bool("is_offset"),
    isDigital: bool("is_digital"),
    isScreen: bool("is_screen"),
    printColors: str("print_colors"),
    printOperator: str("print_operator"),
    printDate: str("print_date") || undefined,
    isNumbering: bool("is_numbering"),
    numberingFrom: num("numbering_from"),
    numberingTo: num("numbering_to"),
    isBinding: bool("is_binding"),
    isUv: bool("is_uv"),
    isFoil: bool("is_foil"),
    isDieCutting: bool("is_die_cutting"),
    isHalfCutting: bool("is_half_cutting"),
    isCreasing: bool("is_creasing"),
    isPasting: bool("is_pasting"),
    isLamination: bool("is_lamination"),
    isFolding: bool("is_folding"),
    isGumming: bool("is_gumming"),
    postPrintDate: str("post_print_date") || undefined,
    bindingOperator: str("binding_operator"),
    packingOperator: str("packing_operator"),
    advanceAmount: num("advance_amount"),
    quotationRef: str("quotation_ref"),
    indentNumber: str("indent_number"),
    deliveryQuantity: num("delivery_quantity"),
    challanNumber: str("challan_number"),
    challanDate: str("challan_date"),
  };
}

function buildPatchPayload(form: FormState) {
  const num = (k: string) => form[k] !== "" && form[k] !== undefined ? Number(form[k]) : undefined;
  const str = (k: string) => (form[k] as string) || undefined;
  const bool = (k: string) => boolField(form, k);
  return {
    title: form.title as string,
    description: str("description"),
    job_type: str("job_type"),
    size: str("size"),
    quantity: num("quantity"),
    due_date: str("due_date"),
    paper_type: str("paper_type"),
    machine_id: str("machine_id") || null,
    quoted_price: num("quoted_price"),
    order_type: str("order_type") || "in_house",
    sheet_size: str("sheet_size"),
    sheet_count: num("sheet_count"),
    paper_gsm: num("paper_gsm"),
    composing_date: str("composing_date"),
    composing_amount: num("composing_amount"),
    plate_cost: num("plate_cost"),
    die_cost: num("die_cost"),
    plate_source: str("plate_source"),
    approved_rate: num("approved_rate"),
    hela_cost: num("hela_cost"),
    other_cost: num("other_cost"),
    proof_required: bool("proof_required"),
    is_offset: bool("is_offset"),
    is_digital: bool("is_digital"),
    is_screen: bool("is_screen"),
    print_colors: str("print_colors"),
    print_operator: str("print_operator"),
    print_date: str("print_date") || undefined,
    is_numbering: bool("is_numbering"),
    numbering_from: num("numbering_from"),
    numbering_to: num("numbering_to"),
    is_binding: bool("is_binding"),
    is_uv: bool("is_uv"),
    is_foil: bool("is_foil"),
    is_die_cutting: bool("is_die_cutting"),
    is_half_cutting: bool("is_half_cutting"),
    is_creasing: bool("is_creasing"),
    is_pasting: bool("is_pasting"),
    is_lamination: bool("is_lamination"),
    is_folding: bool("is_folding"),
    is_gumming: bool("is_gumming"),
    post_print_date: str("post_print_date") || undefined,
    binding_operator: str("binding_operator"),
    packing_operator: str("packing_operator"),
    advance_amount: num("advance_amount"),
    quotation_ref: str("quotation_ref"),
    indent_number: str("indent_number"),
    delivery_quantity: num("delivery_quantity"),
    challan_number: str("challan_number"),
    challan_date: str("challan_date"),
  };
}

function initForm(initial?: Partial<Job>): FormState {
  if (!initial) {
    return {
      client_id: "", title: "", job_type: "", description: "", size: "",
      quantity: "", due_date: "", paper_type: "", machine_id: "", quoted_price: "",
      order_type: "in_house", sheet_size: "", sheet_count: "", paper_gsm: "",
      composing_date: "", composing_amount: "", plate_cost: "", die_cost: "",
      plate_source: "", approved_rate: "", hela_cost: "", other_cost: "",
      proof_required: false,
      is_offset: false, is_digital: false, is_screen: false,
      print_colors: "", print_operator: "", print_date: "",
      is_numbering: false, numbering_from: "", numbering_to: "",
      is_binding: false, is_uv: false, is_foil: false, is_die_cutting: false,
      is_half_cutting: false, is_creasing: false, is_pasting: false,
      is_lamination: false, is_folding: false, is_gumming: false,
      post_print_date: "", binding_operator: "", packing_operator: "",
      advance_amount: "", quotation_ref: "", indent_number: "",
      delivery_quantity: "", challan_number: "", challan_date: "",
    };
  }
  const s = (v: unknown) => (v !== null && v !== undefined ? String(v) : "");
  return {
    client_id: initial.client_id ?? "",
    title: initial.title ?? "",
    job_type: initial.job_type ?? "",
    description: initial.description ?? "",
    size: initial.size ?? "",
    quantity: s(initial.quantity),
    due_date: initial.due_date ? initial.due_date.slice(0, 10) : "",
    paper_type: initial.paper_type ?? "",
    machine_id: initial.machine_id ?? "",
    quoted_price: s(initial.quoted_price),
    order_type: initial.order_type ?? "in_house",
    sheet_size: initial.sheet_size ?? "",
    sheet_count: s(initial.sheet_count),
    paper_gsm: s(initial.paper_gsm),
    composing_date: initial.composing_date ? initial.composing_date.slice(0, 10) : "",
    composing_amount: s(initial.composing_amount),
    plate_cost: s(initial.plate_cost),
    die_cost: s(initial.die_cost),
    plate_source: initial.plate_source ?? "",
    approved_rate: s(initial.approved_rate),
    hela_cost: s(initial.hela_cost),
    other_cost: s(initial.other_cost),
    proof_required: initial.proof_required ?? false,
    is_offset: initial.is_offset ?? false,
    is_digital: initial.is_digital ?? false,
    is_screen: initial.is_screen ?? false,
    print_colors: initial.print_colors ?? "",
    print_operator: initial.print_operator ?? "",
    print_date: initial.print_date ? initial.print_date.slice(0, 10) : "",
    is_numbering: initial.is_numbering ?? false,
    numbering_from: s(initial.numbering_from),
    numbering_to: s(initial.numbering_to),
    is_binding: initial.is_binding ?? false,
    is_uv: initial.is_uv ?? false,
    is_foil: initial.is_foil ?? false,
    is_die_cutting: initial.is_die_cutting ?? false,
    is_half_cutting: initial.is_half_cutting ?? false,
    is_creasing: initial.is_creasing ?? false,
    is_pasting: initial.is_pasting ?? false,
    is_lamination: initial.is_lamination ?? false,
    is_folding: initial.is_folding ?? false,
    is_gumming: initial.is_gumming ?? false,
    post_print_date: initial.post_print_date ? initial.post_print_date.slice(0, 10) : "",
    binding_operator: initial.binding_operator ?? "",
    packing_operator: initial.packing_operator ?? "",
    advance_amount: s(initial.advance_amount),
    quotation_ref: initial.quotation_ref ?? "",
    indent_number: initial.indent_number ?? "",
    delivery_quantity: s(initial.delivery_quantity),
    challan_number: initial.challan_number ?? "",
    challan_date: initial.challan_date ? initial.challan_date.slice(0, 10) : "",
  };
}

function JobForm({ initial, clients, machines, onSave, onCancel, isPending }: {
  initial?: Partial<Job>;
  clients: Client[];
  machines: Machine[];
  onSave: (d: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<FormState>(() => initForm(initial));

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const setCheck = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.checked }));

  const isNumbering = boolField(form, "is_numbering");

  return (
    <div style={{ background: "#fff", padding: 28, borderRadius: 10, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,.10)", maxWidth: 900 }}>
      <h3 style={{ marginBottom: 20, fontSize: 17 }}>{initial?.id ? `Edit Job #${initial.job_number}` : "New Job Card"}</h3>

      {/* Section 1 — Basic Info */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>1. Basic Information</div>
        <div style={gridStyle}>
          <label style={labelStyle}>Client
            <select style={inputStyle} value={form.client_id as string} onChange={set("client_id")}>
              <option value="">— select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Job Name / Title *
            <input style={inputStyle} value={form.title as string} onChange={set("title")} placeholder="e.g. MARRIAGE CARD AND ENVELOPS" />
          </label>
          <label style={labelStyle}>Job Type
            <input style={inputStyle} value={form.job_type as string} onChange={set("job_type")} placeholder="e.g. MARRIAGE CARD AND ENVELOPS" />
          </label>
          <label style={labelStyle}>Order Type
            <select style={inputStyle} value={form.order_type as string} onChange={set("order_type")}>
              <option value="in_house">In House</option>
              <option value="external">External</option>
            </select>
          </label>
          <label style={labelStyle}>Quantity
            <input style={inputStyle} type="number" value={form.quantity as string} onChange={set("quantity")} />
          </label>
          <label style={labelStyle}>Due Date
            <input style={inputStyle} type="date" value={form.due_date as string} onChange={set("due_date")} />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Description
            <textarea style={{ ...inputStyle, height: 64, resize: "vertical" }} value={form.description as string} onChange={set("description")} />
          </label>
        </div>
      </div>

      {/* Section 2 — Paper & Machine */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>2. Paper &amp; Machine</div>
        <div style={gridStyle}>
          <label style={labelStyle}>Paper Type
            <input style={inputStyle} value={form.paper_type as string} onChange={set("paper_type")} placeholder="e.g. COSMO-NEEDLE-TEXTURE CREAM" />
          </label>
          <label style={labelStyle}>Paper GSM
            <input style={inputStyle} type="number" value={form.paper_gsm as string} onChange={set("paper_gsm")} placeholder="e.g. 130" />
          </label>
          <label style={labelStyle}>Sheet Size
            <input style={inputStyle} value={form.sheet_size as string} onChange={set("sheet_size")} placeholder="e.g. 12X18" />
          </label>
          <label style={labelStyle}>Sheet Count
            <input style={inputStyle} type="number" value={form.sheet_count as string} onChange={set("sheet_count")} />
          </label>
          <label style={labelStyle}>Machine
            <select style={inputStyle} value={form.machine_id as string} onChange={set("machine_id")}>
              <option value="">— select machine —</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Section 3 — Pre-Print Process */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>3. Pre-Print Process</div>
        <div style={gridStyle}>
          <label style={labelStyle}>Composing Date
            <input style={inputStyle} type="date" value={form.composing_date as string} onChange={set("composing_date")} />
          </label>
          <label style={labelStyle}>Composing Amount (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.composing_amount as string} onChange={set("composing_amount")} />
          </label>
          <label style={labelStyle}>Plate Cost (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.plate_cost as string} onChange={set("plate_cost")} />
          </label>
          <label style={labelStyle}>Die Cost (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.die_cost as string} onChange={set("die_cost")} />
          </label>
          <label style={labelStyle}>Plate Source
            <input style={inputStyle} value={form.plate_source as string} onChange={set("plate_source")} />
          </label>
          <label style={labelStyle}>Approved Rate (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.approved_rate as string} onChange={set("approved_rate")} />
          </label>
          <label style={labelStyle}>Hela Cost (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.hela_cost as string} onChange={set("hela_cost")} />
          </label>
          <label style={labelStyle}>Other Cost (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.other_cost as string} onChange={set("other_cost")} />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={checkRowStyle}>
            <input type="checkbox" checked={boolField(form, "proof_required")} onChange={setCheck("proof_required")} />
            Proof Required
          </label>
        </div>
      </div>

      {/* Section 4 — Print Process */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>4. Print Process</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_offset")} onChange={setCheck("is_offset")} /> Offset</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_digital")} onChange={setCheck("is_digital")} /> Digital</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_screen")} onChange={setCheck("is_screen")} /> Screen</label>
        </div>
        <div style={gridStyle}>
          <label style={labelStyle}>Print Colors
            <input style={inputStyle} value={form.print_colors as string} onChange={set("print_colors")} placeholder="e.g. MULTICOLOR, 1 COLOR, 4 COLOR" />
          </label>
          <label style={labelStyle}>Print Operator Name
            <input style={inputStyle} value={form.print_operator as string} onChange={set("print_operator")} />
          </label>
          <label style={labelStyle}>Print Date
            <input style={inputStyle} type="date" value={form.print_date as string} onChange={set("print_date")} />
          </label>
        </div>
      </div>

      {/* Section 5 — Post-Print Process */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>5. Post-Print Process</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_numbering")} onChange={setCheck("is_numbering")} /> Numbering</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_binding")} onChange={setCheck("is_binding")} /> Binding</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_uv")} onChange={setCheck("is_uv")} /> UV</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_foil")} onChange={setCheck("is_foil")} /> Foil</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_die_cutting")} onChange={setCheck("is_die_cutting")} /> Die Cutting</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_half_cutting")} onChange={setCheck("is_half_cutting")} /> Half Cutting</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_creasing")} onChange={setCheck("is_creasing")} /> Creasing</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_pasting")} onChange={setCheck("is_pasting")} /> Pasting</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_lamination")} onChange={setCheck("is_lamination")} /> Lamination</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_folding")} onChange={setCheck("is_folding")} /> Folding</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_gumming")} onChange={setCheck("is_gumming")} /> Gumming</label>
        </div>
        {isNumbering && (
          <div style={{ ...gridStyle, marginBottom: 14 }}>
            <label style={labelStyle}>Numbering From
              <input style={inputStyle} type="number" value={form.numbering_from as string} onChange={set("numbering_from")} />
            </label>
            <label style={labelStyle}>Numbering To
              <input style={inputStyle} type="number" value={form.numbering_to as string} onChange={set("numbering_to")} />
            </label>
          </div>
        )}
        <div style={gridStyle}>
          <label style={labelStyle}>Binding Operator
            <input style={inputStyle} value={form.binding_operator as string} onChange={set("binding_operator")} />
          </label>
          <label style={labelStyle}>Packing Operator
            <input style={inputStyle} value={form.packing_operator as string} onChange={set("packing_operator")} />
          </label>
          <label style={labelStyle}>Post-Print Date
            <input style={inputStyle} type="date" value={form.post_print_date as string} onChange={set("post_print_date")} />
          </label>
        </div>
      </div>

      {/* Section 6 — Financial & Delivery */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>6. Financial &amp; Delivery</div>
        <div style={gridStyle}>
          <label style={labelStyle}>Quoted Price (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.quoted_price as string} onChange={set("quoted_price")} />
          </label>
          <label style={labelStyle}>Advance Amount (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.advance_amount as string} onChange={set("advance_amount")} />
          </label>
          <label style={labelStyle}>Quotation Ref
            <input style={inputStyle} value={form.quotation_ref as string} onChange={set("quotation_ref")} placeholder="e.g. NILL" />
          </label>
          <label style={labelStyle}>Indent Number
            <input style={inputStyle} value={form.indent_number as string} onChange={set("indent_number")} />
          </label>
          <label style={labelStyle}>Delivery Quantity
            <input style={inputStyle} type="number" value={form.delivery_quantity as string} onChange={set("delivery_quantity")} />
          </label>
          <label style={labelStyle}>Challan Number
            <input style={inputStyle} value={form.challan_number as string} onChange={set("challan_number")} />
          </label>
          <label style={labelStyle}>Challan Date
            <input style={inputStyle} type="date" value={form.challan_date as string} onChange={set("challan_date")} />
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={() => onSave(form)}
          disabled={!(form.title as string).trim() || isPending}
          style={{ padding: "9px 24px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
        >
          {isPending ? "Saving..." : "Save Job Card"}
        </button>
        <button onClick={onCancel} style={{ padding: "9px 16px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const qc = useQueryClient();
  const [list, actions] = useListState({ sortBy: "created_at", filters: {} });

  const { data, isLoading } = useQuery<PagedResult<Job>>({
    queryKey: ["jobs", actions.toParams()],
    queryFn: () => api.get("/admin/jobs", { params: actions.toParams() }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-mini"],
    queryFn: () => api.get("/admin/clients", { params: { limit: "200" } }).then(r => r.data.data ?? []),
  });

  const { data: machinesResult } = useQuery<{ data: Machine[] }>({
    queryKey: ["machines-mini"],
    queryFn: () => api.get("/admin/machines", { params: { limit: "200" } }).then(r => r.data),
  });
  const machines = machinesResult?.data ?? [];

  const create = useMutation({
    mutationFn: (form: FormState) => api.post("/admin/jobs", buildApiPayload(form)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setShowForm(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, form }: { id: string; form: FormState }) =>
      api.patch(`/admin/jobs/${id}`, buildPatchPayload(form)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/jobs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setDeleteConfirm(null); },
  });

  const col = (label: string, key: string) => (
    <th style={th} onClick={() => actions.setSort(key)}>
      {label}<SortIcon col={key} sortBy={list.sortBy} sortDir={list.sortDir} />
    </th>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Job Cards</h1>
      {showForm && (
        <JobForm
          clients={clients}
          machines={machines}
          isPending={create.isPending}
          onSave={(form) => create.mutate(form)}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editing && (
        <JobForm
          initial={editing}
          clients={clients}
          machines={machines}
          isPending={update.isPending}
          onSave={(form) => update.mutate({ id: editing.id, form })}
          onCancel={() => setEditing(null)}
        />
      )}
      {deleteConfirm && (
        <div style={{ background: "#fff3f3", border: "1px solid #fdd", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14 }}>Delete this job? This cannot be undone.</span>
          <button onClick={() => remove.mutate(deleteConfirm)} disabled={remove.isPending}
            style={{ padding: "6px 16px", background: "#c92a2a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            {remove.isPending ? "Deleting..." : "Confirm Delete"}
          </button>
          <button onClick={() => setDeleteConfirm(null)} style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 13 }}>Cancel</button>
        </div>
      )}
      <TableControls
        search={list.search} onSearch={actions.setSearch} placeholder="Search jobs, clients..."
        activeFilters={list.filters} onFilter={actions.setFilter} onReset={actions.resetFilters}
        filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        rightSlot={<button onClick={() => setShowForm(true)} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ New Job</button>}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
          Due from <input type="date" value={list.filters.dueDateFrom ?? ""} onChange={(e) => actions.setFilter("dueDateFrom", e.target.value)} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
          to <input type="date" value={list.filters.dueDateTo ?? ""} onChange={(e) => actions.setFilter("dueDateTo", e.target.value)} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        </label>
      </div>
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              {col("#", "job_number")}
              {col("Title", "title")}
              <th style={th}>Client</th>
              <th style={th}>Type</th>
              <th style={th}>Sheet Size</th>
              {col("Qty", "quantity")}
              {col("Status", "status")}
              {col("Due", "due_date")}
              <th style={th}>Advance</th>
              {col("Quoted", "quoted_price")}
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#888" }}>Loading...</td></tr>}
            {data?.data?.map((j) => (
              <tr key={j.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ ...td, color: "#888" }}>{j.job_number}</td>
                <td style={{ ...td, fontWeight: 500 }}>{j.title}</td>
                <td style={td}>{j.client_name ?? "—"}</td>
                <td style={td}>{j.job_type ?? "—"}</td>
                <td style={td}>{j.sheet_size ?? "—"}</td>
                <td style={td}>{j.quantity ?? "—"}</td>
                <td style={td}>
                  <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: (STATUS_COLOR[j.status] ?? "#868e96") + "22", color: STATUS_COLOR[j.status] ?? "#868e96" }}>{j.status}</span>
                </td>
                <td style={td}>{j.due_date ? j.due_date.slice(0, 10) : "—"}</td>
                <td style={td}>{j.advance_amount != null ? "Rs." + Number(j.advance_amount).toLocaleString("en-IN") : "—"}</td>
                <td style={td}>{j.quoted_price ? "Rs." + Number(j.quoted_price).toLocaleString("en-IN") : "—"}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditing(j)} style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff" }}>Edit</button>
                    <button onClick={() => setDeleteConfirm(j.id)} style={{ padding: "4px 10px", border: "1px solid #fdd", borderRadius: 6, cursor: "pointer", fontSize: 13, background: "#fff", color: "#c92a2a" }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.data?.length && <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>No jobs found</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
