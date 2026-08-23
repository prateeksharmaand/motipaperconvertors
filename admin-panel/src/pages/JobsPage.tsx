import { fmtDate } from "../lib/fmtDate.ts";
import TableSkeleton from "../components/TableSkeleton.tsx";
import { useAuthStore, useHasPerm } from "../store/auth.ts";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import JobPrintView from "./JobPrintView.tsx";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api.ts";
import { useListState } from "../hooks/useListState.ts";
import TableControls, { SortIcon } from "../components/TableControls.tsx";
import PrintListButton from "../components/PrintListButton.tsx";
import IconButton from "../components/IconButton.tsx";
import Pagination from "../components/Pagination.tsx";
import type { PagedResult } from "../lib/queryHelpers.ts";
import { statusLabel } from "../theme.ts";
import { exportToCsv } from "../lib/exportCsv.ts";

const STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Enquiry", value: "enquiry" }, { label: "Quotation", value: "quotation" },
  { label: "Design", value: "design" }, { label: "Approval", value: "approval" },
  { label: "Print", value: "print" }, { label: "Finishing", value: "finishing" },
  { label: "QC", value: "qc" }, { label: "Ready", value: "ready" },
  { label: "Delivered", value: "delivered" }, { label: "Cancelled", value: "cancelled" },
];

const STATUS_COLOR: Record<string, string> = {
  draft: "#adb5bd",
  enquiry: "#868e96", quotation: "#1971c2", design: "#7048e8", approval: "#f59f00",
  print: "#2f9e44", finishing: "#0c8599", qc: "#e67700", ready: "#2b8a3e",
  delivered: "#1864ab", cancelled: "#c92a2a",
};

type Job = {
  id: string; job_number: number; title: string; client_name: string; client_company_name: string; client_phone: string; client_id: string;
  machine_id: string; status: string; due_date: string; created_at: string; quoted_price: number;
  print_operator_id: string; binding_operator_id: string; packing_operator_id: string; qc_operator_id: string; designer_id: string;
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
  is_lamination: boolean; lamination_type?: string; is_folding: boolean; is_gumming: boolean;
  post_print_date: string; binding_operator: string; packing_operator: string;
  advance_amount: number; quotation_ref: string; indent_number: string;
  delivery_quantity: number; challan_number: string; challan_date: string;
};

interface Client { id: string; name: string; }
interface Machine { id: string; name: string; }
interface PaperStock { id: string; name: string; gsm: number; size: string; unit: string; quantity: number; }
interface StaffUser { id: string; name: string; role: string; }
interface SettingItem { id: string; name: string; }

const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14, boxSizing: "border-box" };
const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: 13, color: "#555", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
const labelStyle: React.CSSProperties = { fontSize: 13, color: "#444", display: "flex", flexDirection: "column", gap: 4 };
const checkRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" };

type FormState = Record<string, string | boolean>;
type PaperLine = { paperStockId: string; sheetCount: number };

function boolField(form: FormState, key: string): boolean {
  const v = form[key];
  return v === true || v === "true";
}

function buildApiPayload(form: FormState, papers: PaperLine[]) {
  const num = (k: string) => form[k] !== "" && form[k] !== undefined ? Number(form[k]) : undefined;
  const str = (k: string) => (form[k] as string) || undefined;
  const bool = (k: string) => boolField(form, k);
  return {
    papers,
    clientId: str("client_id"),
    title: (form.job_type as string) || "—",
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
    printOperatorId: str("print_operator_id") || undefined,
    bindingOperatorId: str("binding_operator_id") || undefined,
    packingOperatorId: str("packing_operator_id") || undefined,
    qcOperatorId: str("qc_operator_id") || undefined,
    designerId: str("designer_id") || undefined,
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
    laminationType: bool("is_lamination") ? (str("lamination_type") || undefined) : undefined,
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

function buildPatchPayload(form: FormState, papers: PaperLine[]) {
  const num = (k: string) => form[k] !== "" && form[k] !== undefined ? Number(form[k]) : undefined;
  const str = (k: string) => (form[k] as string) || undefined;
  const bool = (k: string) => boolField(form, k);
  return {
    papers,
    title: (form.job_type as string) || "—",
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
    print_operator_id: str("print_operator_id") || null,
    binding_operator_id: str("binding_operator_id") || null,
    packing_operator_id: str("packing_operator_id") || null,
    qc_operator_id: str("qc_operator_id") || null,
    designer_id: str("designer_id") || null,
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
    lamination_type: bool("is_lamination") ? (str("lamination_type") || null) : null,
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
      order_type: "in_house", sheet_size: "", sheet_count: "", paper_gsm: "", paper_stock_id: "",
      composing_date: "", composing_amount: "", plate_cost: "", die_cost: "",
      plate_source: "", approved_rate: "", hela_cost: "", other_cost: "",
      proof_required: false,
      is_offset: false, is_digital: false, is_screen: false,
      print_colors: "", print_operator: "", print_date: "",
      is_numbering: false, numbering_from: "", numbering_to: "",
      is_binding: false, is_uv: false, is_foil: false, is_die_cutting: false,
      is_half_cutting: false, is_creasing: false, is_pasting: false,
      is_lamination: false, lamination_type: "", is_folding: false, is_gumming: false,
      post_print_date: "", binding_operator: "", packing_operator: "",
      advance_amount: "", quotation_ref: "", indent_number: "",
      delivery_quantity: "", challan_number: "", challan_date: "",
      print_operator_id: "", binding_operator_id: "", packing_operator_id: "", qc_operator_id: "", designer_id: "",
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
    paper_stock_id: (initial as Record<string, unknown>).paper_stock_id as string ?? "",
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
    lamination_type: (initial as Record<string, unknown>).lamination_type as string ?? "",
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
    print_operator_id: (initial as Record<string, unknown>).print_operator_id as string ?? "",
    binding_operator_id: (initial as Record<string, unknown>).binding_operator_id as string ?? "",
    packing_operator_id: (initial as Record<string, unknown>).packing_operator_id as string ?? "",
    qc_operator_id: (initial as Record<string, unknown>).qc_operator_id as string ?? "",
    designer_id: (initial as Record<string, unknown>).designer_id as string ?? "",
  };
}

// ─── SearchableSelect ────────────────────────────────────────────────────────

interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function SearchableSelect({ options, value, onChange, placeholder = "— select —", disabled = false }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? "";

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = query.trim() === ""
    ? options
    : options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  function handleInputClick() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
  }

  function handleSelect(opt: { value: string; label: string }) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        readOnly={!open}
        disabled={disabled}
        value={open ? query : selectedLabel}
        onChange={e => setQuery(e.target.value)}
        onClick={handleInputClick}
        onFocus={handleInputClick}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled ? "#f5f5f5" : "#fff",
        }}
      />
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
          background: "#fff", border: "1px solid #ddd", borderRadius: 6,
          boxShadow: "0 4px 16px rgba(0,0,0,.12)", maxHeight: 220, overflowY: "auto",
          marginTop: 2,
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: "10px 14px", fontSize: 13, color: "#888" }}>No options found</div>
          )}
          {filtered.map(opt => (
            <div
              key={opt.value}
              onMouseDown={() => handleSelect(opt)}
              style={{
                padding: "9px 14px", fontSize: 13, cursor: "pointer",
                background: opt.value === value ? "#e7ecff" : "transparent",
                color: opt.value === value ? "#3b5bdb" : "#333",
                fontWeight: opt.value === value ? 600 : 400,
              }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = "#f5f7ff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = opt.value === value ? "#e7ecff" : "transparent"; }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  "Basic Info",
  "Paper & Machine",
  "Pre-Print",
  "Print Process",
  "Post-Print",
  "Financial & Delivery",
];

function Stepper({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < current;
        const isActive = stepNum === current;
        const circleColor = isCompleted ? "#2f9e44" : isActive ? "#3b5bdb" : "#ced4da";
        const textColor = isCompleted ? "#2f9e44" : isActive ? "#3b5bdb" : "#868e96";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEP_LABELS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 60 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: circleColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 13, fontWeight: 700,
                flexShrink: 0,
              }}>
                {isCompleted ? "✓" : stepNum}
              </div>
              <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: textColor, marginTop: 4, whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: isCompleted ? "#2f9e44" : "#ced4da", margin: "0 6px", marginBottom: 18 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── JobForm ──────────────────────────────────────────────────────────────────

function JobForm({ initial, initialPapers, clients, machines, plateSources, onCreateDraft, onUpdateDraft, onPublish, onCancel, isSaving }: {
  initial?: Partial<Job>;
  initialPapers?: PaperLine[];
  clients: Client[];
  machines: Machine[];
  plateSources: SettingItem[];
  onCreateDraft: (d: FormState, papers: PaperLine[]) => Promise<string>;
  onUpdateDraft: (id: string, d: FormState, papers: PaperLine[]) => Promise<void>;
  onPublish: (id: string, d: FormState, papers: PaperLine[]) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(() => initForm(initial));
  const [papers, setPapers] = useState<PaperLine[]>(initialPapers ?? []);
  const [draftJobId, setDraftJobId] = useState<string | null>(initial?.id ?? null);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const setVal = (k: string, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const setCheck = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.checked }));

  const isNumbering = boolField(form, "is_numbering");
  const isLamination = boolField(form, "is_lamination");

  // Paper stocks
  const { data: paperStocks = [] } = useQuery<PaperStock[]>({
    queryKey: ["paper-stocks-mini"],
    queryFn: () => api.get("/admin/inventory/paper", { params: { limit: "200" } }).then(r => r.data.data ?? []),
  });

  // Staff users (operators only)
  const { data: staffUsers = [] } = useQuery<StaffUser[]>({
    queryKey: ["staff-users"],
    queryFn: () => api.get("/admin/users", { params: { limit: "200", role: "operator", status: "active" } }).then(r => r.data.data ?? []),
  });

  // Job types
  const { data: jobTypes = [] } = useQuery<SettingItem[]>({
    queryKey: ["settings-job-types"],
    queryFn: () => api.get("/admin/settings/job-types").then(r => r.data),
  });

  // Print colors
  const { data: printColors = [] } = useQuery<SettingItem[]>({
    queryKey: ["settings-print-colors"],
    queryFn: () => api.get("/admin/settings/print-colors").then(r => r.data),
  });

  // Derived option arrays
  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }));
  const machineOptions = machines.map(m => ({ value: m.id, label: m.name }));
  const plateSourceOptions = plateSources.map(p => ({ value: p.name, label: p.name }));
  const jobTypeOptions = jobTypes.map(jt => ({ value: jt.name, label: jt.name }));
  const printColorOptions = printColors.map(pc => ({ value: pc.name, label: pc.name }));
  const paperOptions = paperStocks.map(p => ({ value: p.id, label: `${p.name} ${p.gsm}gsm ${p.size}` }));
  const staffOptions = staffUsers.map(u => ({ value: u.id, label: u.name }));
  const orderTypeOptions = [
    { value: "in_house", label: "In House" },
    { value: "external", label: "External" },
  ];


  // Per-step validation
  function validateStep(s: number): boolean {
    if (s === 1) {
      const today = new Date().toISOString().slice(0, 10);
      const dueDate = (form.due_date as string).trim();
      return (
        (form.client_id as string).trim() !== "" &&
        (form.job_type as string).trim() !== "" &&
        (form.quantity as string).trim() !== "" &&
        dueDate !== "" &&
        dueDate >= today
      );
    }
    if (s === 2) {
      return (form.machine_id as string).trim() !== "";
    }
    return true;
  }

  async function handleNext() {
    if (!validateStep(step)) {
      setStepError(true);
      return;
    }
    setStepError(false);
    // Save as draft on every Next
    if (!draftJobId) {
      const id = await onCreateDraft(form, papers);
      setDraftJobId(id);
    } else {
      await onUpdateDraft(draftJobId, form, papers);
    }
    if (step < 6) setStep(s => s + 1);
  }

  function handlePrev() {
    setStepError(false);
    if (step > 1) setStep(s => s - 1);
  }

  async function handlePublish() {
    if (!draftJobId) {
      const id = await onCreateDraft(form, papers);
      await onPublish(id, form, papers);
    } else {
      await onPublish(draftJobId, form, papers);
    }
  }

  // Display names for summary
  const clientName = clients.find(c => c.id === (form.client_id as string))?.name ?? "—";
  const machineName = machines.find(m => m.id === (form.machine_id as string))?.name ?? "—";

  const stepContent: Record<number, React.ReactNode> = {
    1: (
      <div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            Client
            <SearchableSelect
              options={clientOptions}
              value={form.client_id as string}
              onChange={v => setVal("client_id", v)}
              placeholder="— select client —"
            />
          </label>
          <label style={labelStyle}>
            Job Title
            <SearchableSelect
              options={jobTypeOptions}
              value={form.job_type as string}
              onChange={v => setVal("job_type", v)}
              placeholder="— select job title —"
            />
          </label>
          <label style={labelStyle}>
            Order Type
            <SearchableSelect
              options={orderTypeOptions}
              value={form.order_type as string}
              onChange={v => setVal("order_type", v)}
              placeholder="— select order type —"
            />
          </label>
          <label style={labelStyle}>
            Quantity
            <input style={inputStyle} type="number" value={form.quantity as string} onChange={set("quantity")} />
          </label>
          <label style={labelStyle}>
            Due Date
            <input style={inputStyle} type="date" value={form.due_date as string} onChange={set("due_date")} min={new Date().toISOString().slice(0, 10)} />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>
            Description
            <textarea style={{ ...inputStyle, height: 72, resize: "vertical" }} value={form.description as string} onChange={set("description")} />
          </label>
        </div>
      </div>
    ),

    2: (
      <div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            Machine
            <SearchableSelect
              options={machineOptions}
              value={form.machine_id as string}
              onChange={v => setVal("machine_id", v)}
              placeholder="— select machine —"
            />
          </label>
          <label style={labelStyle}>
            Sheet Size
            <input style={inputStyle} value={form.sheet_size as string} onChange={set("sheet_size")} placeholder="e.g. 12X18" />
          </label>
          <label style={labelStyle}>
            Sheet Count
            <input style={inputStyle} type="number" min={0} value={form.sheet_count as string} onChange={set("sheet_count")} placeholder="e.g. 500" />
          </label>
        </div>

        {/* Multi-paper section */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#3b5bdb", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Paper Used
          </div>
          {papers.map((p, i) => {
            const stock = paperStocks.find(s => s.id === p.paperStockId);
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 160px 36px", gap: 10, marginBottom: 10, alignItems: "end" }}>
                <label style={labelStyle}>
                  {i === 0 ? "Paper" : ""}
                  <SearchableSelect
                    options={paperOptions}
                    value={p.paperStockId}
                    onChange={v => {
                      const s = paperStocks.find(ps => ps.id === v);
                      setPapers(prev => prev.map((pp, j) => j === i ? { ...pp, paperStockId: v } : pp));
                      if (s && i === 0) setForm(f => ({ ...f, paper_type: s.name, paper_gsm: String(s.gsm), paper_stock_id: s.id }));
                    }}
                    placeholder="— select paper —"
                  />
                </label>
                <label style={labelStyle}>
                  {i === 0 ? "Sheets" : ""}
                  <input
                    style={inputStyle}
                    type="number"
                    min={1}
                    value={p.sheetCount || ""}
                    onChange={e => setPapers(prev => prev.map((pp, j) => j === i ? { ...pp, sheetCount: Number(e.target.value) } : pp))}
                    placeholder="No. of sheets"
                  />
                </label>
                <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                  <button
                    type="button"
                    onClick={() => setPapers(prev => prev.filter((_, j) => j !== i))}
                    style={{ width: 32, height: 36, border: "1px solid #fdd", borderRadius: 6, cursor: "pointer", background: "#fff", color: "#c92a2a", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >×</button>
                </div>
                {stock && (
                  <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#868e96", marginTop: -6 }}>
                    Available: <strong>{Number(stock.quantity).toLocaleString("en-IN")} {stock.unit}</strong>
                    {p.sheetCount > 0 && Number(stock.quantity) < p.sheetCount && (
                      <span style={{ color: "#c92a2a", marginLeft: 8, fontWeight: 600 }}>⚠ Insufficient stock</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setPapers(prev => [...prev, { paperStockId: "", sheetCount: 0 }])}
            style={{ padding: "6px 16px", border: "1px dashed #3b5bdb", borderRadius: 6, cursor: "pointer", background: "#f5f7ff", color: "#3b5bdb", fontSize: 13, fontWeight: 600, marginTop: 4 }}
          >
            + Add Paper
          </button>
        </div>
      </div>
    ),

    3: (
      <div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            Designer
            <SearchableSelect
              options={staffUsers.map(u => ({ value: u.id, label: u.name }))}
              value={form.designer_id as string}
              onChange={v => setVal("designer_id", v)}
              placeholder="— assign designer —"
            />
          </label>
          <label style={labelStyle}>
            Composing Date
            <input style={inputStyle} type="date" value={form.composing_date as string} onChange={set("composing_date")} />
          </label>
          <label style={labelStyle}>
            Composing Amount (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.composing_amount as string} onChange={set("composing_amount")} />
          </label>
          <label style={labelStyle}>
            Plate Cost (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.plate_cost as string} onChange={set("plate_cost")} />
          </label>
          <label style={labelStyle}>
            Die Cost (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.die_cost as string} onChange={set("die_cost")} />
          </label>
          <label style={labelStyle}>
            Plate Source
            <SearchableSelect
              options={plateSourceOptions}
              value={form.plate_source as string}
              onChange={v => setVal("plate_source", v)}
              placeholder="— select plate source —"
            />
          </label>
          <label style={labelStyle}>
            Approved Rate (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.approved_rate as string} onChange={set("approved_rate")} />
          </label>
          <label style={labelStyle}>
            Hela Cost (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.hela_cost as string} onChange={set("hela_cost")} />
          </label>
          <label style={labelStyle}>
            Other Cost (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.other_cost as string} onChange={set("other_cost")} />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={checkRowStyle}>
            <input type="checkbox" checked={boolField(form, "proof_required")} onChange={setCheck("proof_required")} />
            Proof Required
          </label>
        </div>
      </div>
    ),

    4: (
      <div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_offset")} onChange={setCheck("is_offset")} /> Offset</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_digital")} onChange={setCheck("is_digital")} /> Digital</label>
          <label style={checkRowStyle}><input type="checkbox" checked={boolField(form, "is_screen")} onChange={setCheck("is_screen")} /> Screen</label>
        </div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            Print Colors
            <SearchableSelect
              options={printColorOptions}
              value={form.print_colors as string}
              onChange={v => setVal("print_colors", v)}
              placeholder="— select print colors —"
            />
          </label>
          <label style={labelStyle}>
            Print Operator
            <SearchableSelect
              options={staffOptions}
              value={form.print_operator_id as string}
              onChange={v => {
                const name = staffUsers.find(u => u.id === v)?.name ?? "";
                setForm(f => ({ ...f, print_operator_id: v, print_operator: name }));
              }}
              placeholder="— select operator —"
            />
          </label>
          <label style={labelStyle}>
            Print Date
            <input style={inputStyle} type="date" value={form.print_date as string} onChange={set("print_date")} />
          </label>
        </div>
      </div>
    ),

    5: (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {([
            ["is_numbering", "Numbering"],
            ["is_binding", "Binding"],
            ["is_uv", "UV"],
            ["is_foil", "Foil"],
            ["is_die_cutting", "Die Cutting"],
            ["is_half_cutting", "Half Cutting"],
            ["is_creasing", "Creasing"],
            ["is_pasting", "Pasting"],
            ["is_lamination", "Lamination"],
            ["is_folding", "Folding"],
            ["is_gumming", "Gumming"],
          ] as [string, string][]).map(([key, label]) => (
            <label key={key} style={checkRowStyle}>
              <input type="checkbox" checked={boolField(form, key)} onChange={setCheck(key)} />
              {label}
            </label>
          ))}
        </div>
        {isNumbering && (
          <div style={{ ...gridStyle, marginBottom: 20 }}>
            <label style={labelStyle}>
              Numbering From
              <input style={inputStyle} type="number" value={form.numbering_from as string} onChange={set("numbering_from")} />
            </label>
            <label style={labelStyle}>
              Numbering To
              <input style={inputStyle} type="number" value={form.numbering_to as string} onChange={set("numbering_to")} />
            </label>
          </div>
        )}
        {isLamination && (
          <div style={{ ...gridStyle, marginBottom: 20 }}>
            <label style={labelStyle}>
              Lamination Type
              <select style={inputStyle} value={form.lamination_type as string} onChange={e => setForm(f => ({ ...f, lamination_type: e.target.value }))}>
                <option value="">— select type —</option>
                <option value="glass">Glass</option>
                <option value="matte">Matte</option>
              </select>
            </label>
          </div>
        )}
        <div style={gridStyle}>
          <label style={labelStyle}>
            Binding Operator
            <SearchableSelect
              options={staffOptions}
              value={form.binding_operator_id as string}
              onChange={v => {
                const name = staffUsers.find(u => u.id === v)?.name ?? "";
                setForm(f => ({ ...f, binding_operator_id: v, binding_operator: name }));
              }}
              placeholder="— select operator —"
            />
          </label>
          <label style={labelStyle}>
            Packing Operator
            <SearchableSelect
              options={staffOptions}
              value={form.packing_operator_id as string}
              onChange={v => {
                const name = staffUsers.find(u => u.id === v)?.name ?? "";
                setForm(f => ({ ...f, packing_operator_id: v, packing_operator: name }));
              }}
              placeholder="— select operator —"
            />
          </label>
          <label style={labelStyle}>
            Post-Print Date
            <input style={inputStyle} type="date" value={form.post_print_date as string} onChange={set("post_print_date")} />
          </label>
        </div>
      </div>
    ),

    6: (
      <div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            Quoted Price (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.quoted_price as string} onChange={set("quoted_price")} />
          </label>
          <label style={labelStyle}>
            Advance Amount (Rs.)
            <input style={inputStyle} type="number" step="0.01" value={form.advance_amount as string} onChange={set("advance_amount")} />
          </label>
          <label style={labelStyle}>
            Quotation Ref
            <input style={inputStyle} value={form.quotation_ref as string} onChange={set("quotation_ref")} placeholder="e.g. NILL" />
          </label>
          <label style={labelStyle}>
            Indent Number
            <input style={inputStyle} value={form.indent_number as string} onChange={set("indent_number")} />
          </label>
          <label style={labelStyle}>
            Delivery Quantity
            <input style={inputStyle} type="number" value={form.delivery_quantity as string} onChange={set("delivery_quantity")} />
          </label>
          <label style={labelStyle}>
            Challan Number
            <input style={inputStyle} value={form.challan_number as string} onChange={set("challan_number")} />
          </label>
          <label style={labelStyle}>
            Challan Date
            <input style={inputStyle} type="date" value={form.challan_date as string} onChange={set("challan_date")} />
          </label>
        </div>

        {/* Summary */}
        <div style={{
          marginTop: 28, padding: 20, background: "#f8f9ff",
          border: "1px solid #e7ecff", borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#3b5bdb", marginBottom: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Job Summary
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {([
              ["Client", clientName],
              ["Job Title", (form.job_type as string) || "—"],
              ["Quantity", (form.quantity as string) || "—"],
              ["Machine", machineName],
              ["Due Date", (form.due_date as string) || "—"],
              ["Quoted Price", (form.quoted_price as string) ? `Rs.${form.quoted_price}` : "—"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: "#868e96", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
                <div style={{ fontSize: 14, color: "#212529", fontWeight: 500, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div style={{
      background: "#fff", padding: 32, borderRadius: 10, marginBottom: 20,
      boxShadow: "0 2px 8px rgba(0,0,0,.10)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: initial?.status === "draft" ? 12 : 24 }}>
        <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 10 }}>
          {initial?.id ? `Edit Job #${initial.job_number}` : "New Job Card"}
          {!initial?.id && <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 10, background: "#adb5bd22", color: "#6b7280", border: "1px solid #ced4da" }}>Will save as Draft</span>}
          {initial?.status === "draft" && <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: "#adb5bd33", color: "#495057", border: "1px solid #ced4da" }}>DRAFT</span>}
        </h3>
        <button
          onClick={onCancel}
          style={{ padding: "6px 14px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff", fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
      {initial?.status === "draft" && (
        <div style={{ background: "#fff9e6", border: "1px solid #ffe066", borderRadius: 7, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#664d03" }}>
          ⚠️ This job is a <strong>Draft</strong> — not visible to assigned staff. Go to the last step and save to publish it.
        </div>
      )}

      <Stepper current={step} />

      <div style={{ minHeight: 260, padding: "4px 0 24px" }}>
        {stepContent[step]}
      </div>

      {stepError && (
        <div style={{ color: "#c92a2a", fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
          {step === 1 && (form.due_date as string) && (form.due_date as string) < new Date().toISOString().slice(0, 10)
            ? "Due date cannot be earlier than today."
            : "Please fill all required fields before proceeding."}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f0f0f0", paddingTop: 20 }}>
        <button
          onClick={handlePrev}
          disabled={step === 1}
          style={{
            padding: "9px 22px", border: "1px solid #ddd", borderRadius: 6,
            cursor: step === 1 ? "not-allowed" : "pointer", background: "#fff",
            fontWeight: 500, fontSize: 14, opacity: step === 1 ? 0.4 : 1,
          }}
        >
          &larr; Previous
        </button>

        {step < 6 ? (
          <button
            onClick={handleNext}
            disabled={isSaving}
            style={{
              padding: "9px 22px", background: "#3b5bdb", color: "#fff",
              border: "none", borderRadius: 6, cursor: isSaving ? "not-allowed" : "pointer",
              fontWeight: 600, fontSize: 14, opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? "Saving…" : "Next →"}
          </button>
        ) : (
          <button
            onClick={handlePublish}
            disabled={isSaving}
            style={{
              padding: "9px 24px", background: "#2f9e44", color: "#fff",
              border: "none", borderRadius: 6, cursor: isSaving ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 14, opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? "Saving..." : "✓ Save & Publish"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── EditingJobFormWrapper ────────────────────────────────────────────────────

function EditingJobFormWrapper({ job, clients, machines, plateSources, isSaving, onUpdateDraft, onPublish, onCancel }: {
  job: Job;
  clients: Client[];
  machines: Machine[];
  plateSources: SettingItem[];
  isSaving: boolean;
  onUpdateDraft: (id: string, form: FormState, papers: PaperLine[]) => Promise<void>;
  onPublish: (id: string, form: FormState, papers: PaperLine[]) => Promise<void>;
  onCancel: () => void;
}) {
  const { data: jobDetail, isLoading } = useQuery<{ papers: PaperLine[] }>({
    queryKey: ["job-detail", job.id],
    queryFn: () => api.get(`/admin/jobs/${job.id}`).then(r => r.data),
  });

  if (isLoading) return <div style={{ padding: 32, textAlign: "center", color: "#888" }}>Loading job details...</div>;

  return (
    <JobForm
      initial={job}
      initialPapers={jobDetail?.papers ?? []}
      clients={clients}
      machines={machines}
      plateSources={plateSources}
      isSaving={isSaving}
      onCreateDraft={async (_form, _papers) => job.id}
      onUpdateDraft={onUpdateDraft}
      onPublish={onPublish}
      onCancel={onCancel}
    />
  );
}

// ─── JobDetailModal ───────────────────────────────────────────────────────────

function JobDetailModal({ job, clients, machines, staffUsers, onClose, onEdit, onPrint }: {
  job: Job;
  clients: Client[];
  machines: Machine[];
  staffUsers: StaffUser[];
  onClose: () => void;
  onEdit: () => void;
  onPrint: () => void;
}) {
  const clientName = clients.find(c => c.id === job.client_id)?.name ?? job.client_name ?? "—";
  const machineName = machines.find(m => m.id === job.machine_id)?.name ?? "—";
  const printOpName = staffUsers.find(u => u.id === job.print_operator_id)?.name ?? job.print_operator ?? "—";
  const bindOpName = staffUsers.find(u => u.id === job.binding_operator_id)?.name ?? job.binding_operator ?? "—";
  const packOpName = staffUsers.find(u => u.id === job.packing_operator_id)?.name ?? job.packing_operator ?? "—";
  const designerName = staffUsers.find(u => u.id === job.designer_id)?.name ?? "—";

  const row = (label: string, value: unknown) => (
    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 11, color: "#868e96", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 14, color: "#212529", fontWeight: 500 }}>{value != null && value !== "" ? String(value) : "—"}</div>
    </div>
  );

  const bool = (v: boolean | undefined) => v ? "Yes" : "No";

  const sectionTitle = (t: string) => (
    <div style={{ gridColumn: "1 / -1", fontWeight: 700, fontSize: 13, color: "#3b5bdb", borderBottom: "1px solid #e7ecff", paddingBottom: 6, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t}</div>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "100%", maxWidth: 820,
        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        padding: 32,
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "#868e96", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Job #{job.job_number}</div>
            <h2 style={{ margin: "4px 0 6px", fontSize: 20, color: "#212529" }}>{job.job_type ?? "—"}</h2>
            <span style={{
              padding: "3px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: (STATUS_COLOR[job.status] ?? "#868e96") + "22",
              color: STATUS_COLOR[job.status] ?? "#868e96",
            }}>
              {statusLabel(job.status)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onPrint} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13 }}>🖨️ Print</button>
            <button onClick={onEdit} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Edit</button>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13 }}>Close</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {sectionTitle("Basic Info")}
          {row("Company", job.client_company_name || clientName)}
          {row("Contact Name", job.client_name || "—")}
          {row("Phone", job.client_phone || "—")}
          {row("Created Date", fmtDate(job.created_at))}
          {row("Job Title", job.job_type)}
          {row("Order Type", job.order_type === "in_house" ? "In House" : job.order_type)}
          {row("Quantity", job.quantity)}
          {row("Due Date", fmtDate(job.due_date))}
          {row("Description", job.description)}

          {sectionTitle("Paper & Machine")}
          {row("Machine", machineName)}
          {row("Paper Type", job.paper_type)}
          {row("Paper GSM", job.paper_gsm)}
          {row("Sheet Size", job.sheet_size)}
          {row("Sheet Count", job.sheet_count)}

          {sectionTitle("Pre-Print")}
          {row("Designer", designerName)}
          {row("Composing Date", fmtDate(job.composing_date))}
          {row("Composing Amount", job.composing_amount != null ? `Rs.${Number(job.composing_amount).toLocaleString("en-IN")}` : "")}
          {row("Plate Cost", job.plate_cost != null ? `Rs.${Number(job.plate_cost).toLocaleString("en-IN")}` : "")}
          {row("Die Cost", job.die_cost != null ? `Rs.${Number(job.die_cost).toLocaleString("en-IN")}` : "")}
          {row("Plate Source", job.plate_source)}
          {row("Approved Rate", job.approved_rate != null ? `Rs.${Number(job.approved_rate).toLocaleString("en-IN")}` : "")}
          {row("Hela Cost", job.hela_cost != null ? `Rs.${Number(job.hela_cost).toLocaleString("en-IN")}` : "")}
          {row("Other Cost", job.other_cost != null ? `Rs.${Number(job.other_cost).toLocaleString("en-IN")}` : "")}
          {row("Proof Required", bool(job.proof_required))}

          {sectionTitle("Print Process")}
          {row("Offset", bool(job.is_offset))}
          {row("Digital", bool(job.is_digital))}
          {row("Screen", bool(job.is_screen))}
          {row("Print Colors", job.print_colors)}
          {row("Print Operator", printOpName)}
          {row("Print Date", fmtDate(job.print_date))}

          {sectionTitle("Post-Print")}
          {row("Numbering", bool(job.is_numbering))}
          {job.is_numbering && row("Numbering From–To", `${job.numbering_from ?? "—"} – ${job.numbering_to ?? "—"}`)}
          {row("Binding", bool(job.is_binding))}
          {row("UV", bool(job.is_uv))}
          {row("Foil", bool(job.is_foil))}
          {row("Die Cutting", bool(job.is_die_cutting))}
          {row("Half Cutting", bool(job.is_half_cutting))}
          {row("Creasing", bool(job.is_creasing))}
          {row("Pasting", bool(job.is_pasting))}
          {row("Lamination", job.is_lamination ? (job.lamination_type ? `Yes – ${job.lamination_type.charAt(0).toUpperCase() + job.lamination_type.slice(1)}` : "Yes") : "No")}
          {row("Folding", bool(job.is_folding))}
          {row("Gumming", bool(job.is_gumming))}
          {row("Binding Operator", bindOpName)}
          {row("Packing Operator", packOpName)}
          {row("Post-Print Date", fmtDate(job.post_print_date))}

          {sectionTitle("Financial & Delivery")}
          {row("Quoted Price", job.quoted_price != null ? `Rs.${Number(job.quoted_price).toLocaleString("en-IN")}` : "")}
          {row("Advance Amount", job.advance_amount != null ? `Rs.${Number(job.advance_amount).toLocaleString("en-IN")}` : "")}
          {row("Quotation Ref", job.quotation_ref)}
          {row("Indent Number", job.indent_number)}
          {row("Delivery Quantity", job.delivery_quantity)}
          {row("Challan Number", job.challan_number)}
          {row("Challan Date", fmtDate(job.challan_date))}
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [printJob, setPrintJob] = useState<Job | null>(null);
  const [startedJobs, setStartedJobs] = useState<Set<string>>(new Set());
  const qc = useQueryClient();
  const currentUserId = useAuthStore(s => s.userId);
  const currentRole = useAuthStore(s => s.role);
  const canCreate = useHasPerm("jobs.create");
  const canEdit = useHasPerm("jobs.edit");
  const canDelete = useHasPerm("jobs.delete");

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get("/admin/jobs", { params: { limit: 5000 } });
      const jobs: Job[] = res.data.data ?? [];
      const rows = jobs.map(j => ({
        job_number: j.job_number, title: j.title, client_name: j.client_name,
        job_type: j.job_type, order_type: j.order_type, status: j.status,
        quantity: j.quantity, sheet_size: j.sheet_size, paper_type: j.paper_type,
        paper_gsm: j.paper_gsm, quoted_price: j.quoted_price,
        advance_amount: j.advance_amount,
        due_date: j.due_date ? j.due_date.slice(0, 10) : "",
        created_at: "",
      }));
      exportToCsv(`jobs-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    } finally {
      setExporting(false);
    }
  }
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

  const { data: plateSources = [] } = useQuery<SettingItem[]>({
    queryKey: ["settings-plate-sources"],
    queryFn: () => api.get("/admin/settings/plate-sources").then(r => r.data),
    enabled: showForm || !!editing,
  });

  const { data: staffUsersMain = [] } = useQuery<StaffUser[]>({
    queryKey: ["staff-users"],
    queryFn: () => api.get("/admin/users", { params: { limit: "200", role: "operator", status: "active" } }).then(r => r.data.data ?? []),
  });

  const { data: printTemplate } = useQuery<{ header: string; footer: string; signature: string }>({
    queryKey: ["print-template"],
    queryFn: () => api.get("/admin/settings/print-template").then(r => r.data),
  });

  const create = useMutation({
    mutationFn: ({ form, papers }: { form: FormState; papers: PaperLine[] }) =>
      api.post("/admin/jobs", buildApiPayload(form, papers)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setShowForm(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, form, papers }: { id: string; form: FormState; papers: PaperLine[] }) =>
      api.patch(`/admin/jobs/${id}`, buildPatchPayload(form, papers)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setEditing(null); },
  });

  const publish = useMutation({
    mutationFn: async ({ id, form, papers }: { id: string; form: FormState; papers: PaperLine[] }) => {
      await api.patch(`/admin/jobs/${id}`, buildPatchPayload(form, papers));
      await api.patch(`/admin/jobs/${id}/status`, { status: "enquiry" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setEditing(null); },
  });

  const createAndPublish = useMutation({
    mutationFn: async ({ form, papers }: { form: FormState; papers: PaperLine[] }) => {
      const { data: job } = await api.post("/admin/jobs", buildApiPayload(form, papers));
      await api.patch(`/admin/jobs/${job.id}/status`, { status: "enquiry" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setShowForm(false); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/jobs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setDeleteConfirm(null); },
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/jobs/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const logNote = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/admin/jobs/${id}/note`, { note }),
  });

  const markStarted = (jobId: string, role: string) => {
    logNote.mutate({ id: jobId, note: `${role} started` });
    setStartedJobs(prev => new Set(prev).add(jobId));
  };

  const col = (label: string, key: string) => (
    <th style={th} onClick={() => actions.setSort(key)}>
      {label}<SortIcon col={key} sortBy={list.sortBy} sortDir={list.sortDir} />
    </th>
  );

  return (
    <div>
      {printJob && (
        <JobPrintView
          job={printJob}
          template={printTemplate ?? { header: "", footer: "", signature: "" }}
          onClose={() => setPrintJob(null)}
        />
      )}
      {viewJob && (
        <JobDetailModal
          job={viewJob}
          clients={clients}
          machines={machines}
          staffUsers={staffUsersMain}
          onClose={() => setViewJob(null)}
          onEdit={() => { setEditing(viewJob); setViewJob(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onPrint={() => { setPrintJob(viewJob); setViewJob(null); }}
        />
      )}
      <h1 style={{ marginBottom: 20 }}>Job Cards</h1>
      {showForm && (
        <JobForm
          clients={clients}
          machines={machines}
          plateSources={plateSources}
          isSaving={create.isPending || createAndPublish.isPending}
          onCreateDraft={(form, papers) =>
            api.post("/admin/jobs", buildApiPayload(form, papers)).then(r => { qc.invalidateQueries({ queryKey: ["jobs"] }); return r.data.id as string; })
          }
          onUpdateDraft={(id, form, papers) =>
            api.patch(`/admin/jobs/${id}`, buildPatchPayload(form, papers)).then(() => { qc.invalidateQueries({ queryKey: ["jobs"] }); })
          }
          onPublish={(id, _form, _papers) =>
            api.patch(`/admin/jobs/${id}/status`, { status: "enquiry" }).then(() => { qc.invalidateQueries({ queryKey: ["jobs"] }); setShowForm(false); })
          }
          onCancel={() => setShowForm(false)}
        />
      )}
      {editing && (
        <EditingJobFormWrapper
          job={editing}
          clients={clients}
          machines={machines}
          plateSources={plateSources}
          isSaving={update.isPending || publish.isPending}
          onUpdateDraft={(id, form, papers) =>
            api.patch(`/admin/jobs/${id}`, buildPatchPayload(form, papers)).then(() => { qc.invalidateQueries({ queryKey: ["jobs"] }); })
          }
          onPublish={(id, form, papers) =>
            api.patch(`/admin/jobs/${id}`, buildPatchPayload(form, papers))
              .then(() => api.patch(`/admin/jobs/${id}/status`, { status: editing.status === "draft" ? "enquiry" : editing.status }))
              .then(() => { qc.invalidateQueries({ queryKey: ["jobs"] }); setEditing(null); })
          }
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
        rightSlot={<div style={{ display: "flex", gap: 8 }}><PrintListButton /><button onClick={handleExport} disabled={exporting} style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{exporting ? "Exporting…" : "⬇ Export Jobs"}</button>{canCreate && <button onClick={() => { setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ padding: "8px 18px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>+ New Job</button>}</div>}
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
              {col("Job Title", "job_type")}
              <th style={th}>Company</th>
              <th style={th}>Sheet Size</th>
              {col("Qty", "quantity")}
              {col("Status", "status")}
              {col("Created", "created_at")}
              {col("Due", "due_date")}
              <th style={th}>Advance</th>
              {col("Quoted", "quoted_price")}
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton cols={10} />}
            {data?.data?.map((j) => (
              <tr key={j.id} style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer", background: (STATUS_COLOR[j.status] ?? "#868e96") + "4D", borderLeft: `3px solid ${STATUS_COLOR[j.status] ?? "#868e96"}` }}
                onClick={() => setViewJob(j)}>
                <td style={{ ...td, color: STATUS_COLOR[j.status] ?? "#868e96", fontWeight: 700 }}>{j.job_number}</td>
                <td style={{ ...td, fontWeight: 600, color: "#111827" }}>{j.job_type ?? "—"}</td>
                <td style={{ ...td, color: "#374151" }}>{j.client_company_name || j.client_name || "—"}</td>
                <td style={{ ...td, color: "#374151" }}>{j.sheet_size ?? "—"}</td>
                <td style={{ ...td, color: "#374151" }}>{j.quantity ?? "—"}</td>
                <td style={td} onClick={e => e.stopPropagation()}>
                  {currentRole === "operator" || currentRole === "staff" ? (
                    <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: (STATUS_COLOR[j.status] ?? "#868e96") + "22", color: STATUS_COLOR[j.status] ?? "#868e96" }}>
                      {statusLabel(j.status)}
                    </span>
                  ) : (
                    <select
                      value={j.status}
                      onChange={e => changeStatus.mutate({ id: j.id, status: e.target.value })}
                      style={{ padding: "3px 8px", borderRadius: 8, border: `1px solid ${STATUS_COLOR[j.status] ?? "#e5e7eb"}`, background: (STATUS_COLOR[j.status] ?? "#868e96") + "18", color: STATUS_COLOR[j.status] ?? "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}
                    >
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                </td>
                <td style={{ ...td, color: "#374151" }}>{fmtDate(j.created_at)}</td>
                <td style={{ ...td, color: "#374151" }}>{fmtDate(j.due_date)}</td>
                <td style={{ ...td, color: "#1f2937", fontWeight: 500 }}>{j.advance_amount != null ? "Rs." + Number(j.advance_amount).toLocaleString("en-IN") : "—"}</td>
                <td style={{ ...td, color: "#1f2937", fontWeight: 600 }}>{j.quoted_price ? "Rs." + Number(j.quoted_price).toLocaleString("en-IN") : "—"}</td>
                <td style={td} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {/* ── Print Operator ── */}
                    {j.print_operator_id === currentUserId && j.status === "approval" && (
                      !startedJobs.has(j.id + "_print")
                        ? <button onClick={() => markStarted(j.id + "_print", "Printing")} style={{ padding: "4px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#2f9e44", color: "#fff" }}>▶ Start Printing</button>
                        : <button onClick={() => changeStatus.mutate({ id: j.id, status: "print" })} style={{ padding: "4px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#1864ab", color: "#fff" }}>🖨 Printing...</button>
                    )}
                    {j.print_operator_id === currentUserId && j.status === "print" && (
                      !startedJobs.has(j.id + "_printdone")
                        ? <button onClick={() => markStarted(j.id + "_printdone", "Printing completed")} style={{ padding: "4px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#e67700", color: "#fff" }}>✓ Printing Done</button>
                        : <button onClick={() => changeStatus.mutate({ id: j.id, status: "finishing" })} style={{ padding: "4px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#0c8599", color: "#fff" }}>→ Send to Binding</button>
                    )}

                    {/* ── Binding Operator ── */}
                    {j.binding_operator_id === currentUserId && j.status === "finishing" && (
                      !startedJobs.has(j.id + "_binding")
                        ? <button onClick={() => markStarted(j.id + "_binding", "Binding started")} style={{ padding: "4px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#7048e8", color: "#fff" }}>▶ Binding Started</button>
                        : <button onClick={() => changeStatus.mutate({ id: j.id, status: "qc" })} style={{ padding: "4px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#0c8599", color: "#fff" }}>✓ Binding Done</button>
                    )}

                    {/* ── Packing Operator ── */}
                    {j.packing_operator_id === currentUserId && j.status === "qc" && (
                      !startedJobs.has(j.id + "_packing")
                        ? <button onClick={() => markStarted(j.id + "_packing", "Packing started")} style={{ padding: "4px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#c2410c", color: "#fff" }}>▶ Packing Started</button>
                        : <button onClick={() => changeStatus.mutate({ id: j.id, status: "ready" })} style={{ padding: "4px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#2b8a3e", color: "#fff" }}>✓ Packing Done → Ready</button>
                    )}
                    {currentRole !== "operator" && currentRole !== "staff" && (
                      <>
                        <IconButton icon="🖨️" tooltip="Print Job Card" onClick={() => setPrintJob(j)} />
                        {canEdit && <IconButton icon="✏️" tooltip="Edit" onClick={() => { setEditing(j); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
                        {canDelete && <IconButton icon="🗑️" tooltip="Delete" onClick={() => setDeleteConfirm(j.id)} danger />}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.data?.length && <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#888", padding: 24 }}>No jobs found</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPage={actions.setPage} />}
    </div>
  );
}
