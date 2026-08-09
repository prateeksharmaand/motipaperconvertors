import { Router } from "express";
import { z } from "zod";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";
import { writeAuditLog } from "../middleware/auditLog.js";
import { nextNumber } from "../lib/jobCounter.js";
import { parseListParams, paginate, applySearch } from "../lib/queryBuilder.js";
import { notifyJobAssigned, notifyJobStatusChanged } from "../lib/notifications.js";

const router = Router();
router.use(requireTenant);

const JOB_SORT_COLS = ["job_number", "title", "status", "due_date", "created_at", "quoted_price"];

// ── GET /jobs ─────────────────────────────────────────────
// Query params: page, limit, search, sortBy, sortDir, status, clientId, machineId, dueDateFrom, dueDateTo
router.get("/", requirePermission("jobs.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "created_at" });
  const tenantId = req.user.tenantId!;
  const { status, clientId, machineId, dueDateFrom, dueDateTo } = req.query as Record<string, string>;

  let base = db("job_cards")
    .where("job_cards.tenant_id", tenantId)
    .leftJoin("clients", "job_cards.client_id", "clients.id")
    .leftJoin("users as operator", "job_cards.assigned_operator_id", "operator.id")
    .select(
      "job_cards.*",
      "clients.name as client_name",
      "operator.name as operator_name",
    );

  // Staff/operators see only their assigned jobs
  if (["staff", "operator"].includes(req.user.role)) {
    base = base.where("job_cards.assigned_operator_id", req.user.id);
  }

  if (status) base = base.where("job_cards.status", status);
  if (clientId) base = base.where("job_cards.client_id", clientId);
  if (machineId) base = base.where("job_cards.machine_id", machineId);
  if (dueDateFrom) base = base.where("job_cards.due_date", ">=", dueDateFrom);
  if (dueDateTo) base = base.where("job_cards.due_date", "<=", dueDateTo);

  base = applySearch(base, params.search, ["job_cards.title", "job_cards.description", "clients.name", "job_cards.job_type"]);

  let countQ = db("job_cards")
    .where("job_cards.tenant_id", tenantId)
    .leftJoin("clients", "job_cards.client_id", "clients.id");
  if (["staff", "operator"].includes(req.user.role)) countQ = countQ.where("job_cards.assigned_operator_id", req.user.id);
  if (status) countQ = countQ.where("job_cards.status", status);
  if (clientId) countQ = countQ.where("job_cards.client_id", clientId);
  if (machineId) countQ = countQ.where("job_cards.machine_id", machineId);
  if (dueDateFrom) countQ = countQ.where("job_cards.due_date", ">=", dueDateFrom);
  if (dueDateTo) countQ = countQ.where("job_cards.due_date", "<=", dueDateTo);
  countQ = applySearch(countQ, params.search, ["job_cards.title", "job_cards.description", "clients.name", "job_cards.job_type"]);

  const result = await paginate(base, countQ, params, JOB_SORT_COLS, "job_cards");
  res.json(result);
});

// ── GET /jobs/:id ─────────────────────────────────────────
router.get("/:id", requirePermission("jobs.view"), async (req, res) => {
  const job = await db("job_cards")
    .where({ "job_cards.id": req.params.id, "job_cards.tenant_id": req.user.tenantId! })
    .leftJoin("clients", "job_cards.client_id", "clients.id")
    .leftJoin("users as operator", "job_cards.assigned_operator_id", "operator.id")
    .select("job_cards.*", "clients.name as client_name", "operator.name as operator_name")
    .first();

  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const statusHistory = await db("job_status_history")
    .where({ job_id: job.id })
    .leftJoin("users", "job_status_history.changed_by", "users.id")
    .select("job_status_history.*", "users.name as changed_by_name")
    .orderBy("changed_at", "asc");

  res.json({ ...job, statusHistory });
});

const CreateJobSchema = z.object({
  clientId: z.string().uuid().optional(),
  title: z.string().min(1),
  jobType: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  size: z.string().optional(),
  colorsFront: z.number().int().min(0).optional(),
  colorsBack: z.number().int().min(0).optional(),
  paperType: z.string().optional(),
  finishing: z.string().optional(),
  dueDate: z.string().optional(),
  machineId: z.string().uuid().optional(),
  assignedOperatorId: z.string().uuid().optional(),
  copiedFromJobId: z.string().uuid().optional(),
  quotedPrice: z.number().optional(),
  // Extended fields
  orderType: z.string().optional(),
  sheetSize: z.string().optional(),
  sheetCount: z.number().int().optional(),
  paperGsm: z.number().int().optional(),
  composingDate: z.string().optional(),
  composingAmount: z.number().optional(),
  plateCost: z.number().optional(),
  dieCost: z.number().optional(),
  plateSource: z.string().optional(),
  approvedRate: z.number().optional(),
  helaCost: z.number().optional(),
  otherCost: z.number().optional(),
  proofRequired: z.boolean().optional(),
  isOffset: z.boolean().optional(),
  isDigital: z.boolean().optional(),
  isScreen: z.boolean().optional(),
  printColors: z.string().optional(),
  printOperator: z.string().optional(),
  printDate: z.string().optional(),
  isNumbering: z.boolean().optional(),
  numberingFrom: z.number().int().optional(),
  numberingTo: z.number().int().optional(),
  isBinding: z.boolean().optional(),
  isUv: z.boolean().optional(),
  isFoil: z.boolean().optional(),
  isDieCutting: z.boolean().optional(),
  isHalfCutting: z.boolean().optional(),
  isCreasing: z.boolean().optional(),
  isPasting: z.boolean().optional(),
  isLamination: z.boolean().optional(),
  isFolding: z.boolean().optional(),
  isGumming: z.boolean().optional(),
  postPrintDate: z.string().optional(),
  bindingOperator: z.string().optional(),
  packingOperator: z.string().optional(),
  advanceAmount: z.number().optional(),
  quotationRef: z.string().optional(),
  indentNumber: z.string().optional(),
  deliveryQuantity: z.number().int().optional(),
  challanNumber: z.string().optional(),
  challanDate: z.string().optional(),
});

// ── POST /jobs ────────────────────────────────────────────
router.post("/", requirePermission("jobs.create"), async (req, res) => {
  const parsed = CreateJobSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const tenantId = req.user.tenantId!;
  const data = parsed.data;

  const job = await db.transaction(async (trx) => {
    const jobNumber = await nextNumber(trx, tenantId, "last_job_number");
    const [inserted] = await trx("job_cards").insert({
      tenant_id: tenantId,
      job_number: jobNumber,
      client_id: data.clientId ?? null,
      machine_id: data.machineId ?? null,
      assigned_operator_id: data.assignedOperatorId ?? null,
      created_by: req.user.id,
      title: data.title,
      job_type: data.jobType ?? null,
      description: data.description ?? null,
      quantity: data.quantity ?? null,
      size: data.size ?? null,
      colors_front: data.colorsFront ?? null,
      colors_back: data.colorsBack ?? null,
      paper_type: data.paperType ?? null,
      finishing: data.finishing ?? null,
      due_date: data.dueDate ?? null,
      copied_from_job_id: data.copiedFromJobId ?? null,
      quoted_price: data.quotedPrice ?? null,
      status: "enquiry",
      // Extended fields
      order_type: data.orderType ?? "in_house",
      sheet_size: data.sheetSize ?? null,
      sheet_count: data.sheetCount ?? null,
      paper_gsm: data.paperGsm ?? null,
      composing_date: data.composingDate ?? null,
      composing_amount: data.composingAmount ?? null,
      plate_cost: data.plateCost ?? null,
      die_cost: data.dieCost ?? null,
      plate_source: data.plateSource ?? null,
      approved_rate: data.approvedRate ?? null,
      hela_cost: data.helaCost ?? null,
      other_cost: data.otherCost ?? null,
      proof_required: data.proofRequired ?? false,
      is_offset: data.isOffset ?? false,
      is_digital: data.isDigital ?? false,
      is_screen: data.isScreen ?? false,
      print_colors: data.printColors ?? null,
      print_operator: data.printOperator ?? null,
      print_date: data.printDate ?? null,
      is_numbering: data.isNumbering ?? false,
      numbering_from: data.numberingFrom ?? null,
      numbering_to: data.numberingTo ?? null,
      is_binding: data.isBinding ?? false,
      is_uv: data.isUv ?? false,
      is_foil: data.isFoil ?? false,
      is_die_cutting: data.isDieCutting ?? false,
      is_half_cutting: data.isHalfCutting ?? false,
      is_creasing: data.isCreasing ?? false,
      is_pasting: data.isPasting ?? false,
      is_lamination: data.isLamination ?? false,
      is_folding: data.isFolding ?? false,
      is_gumming: data.isGumming ?? false,
      post_print_date: data.postPrintDate ?? null,
      binding_operator: data.bindingOperator ?? null,
      packing_operator: data.packingOperator ?? null,
      advance_amount: data.advanceAmount ?? 0,
      quotation_ref: data.quotationRef ?? null,
      indent_number: data.indentNumber ?? null,
      delivery_quantity: data.deliveryQuantity ?? null,
      challan_number: data.challanNumber ?? null,
      challan_date: data.challanDate ?? null,
    }).returning("*");

    await trx("job_status_history").insert({
      job_id: inserted.id,
      changed_by: req.user.id,
      from_status: null,
      to_status: "enquiry",
    });

    return inserted;
  });

  if (data.assignedOperatorId) {
    await notifyJobAssigned(tenantId, data.assignedOperatorId, job.job_number, job.title, job.id);
  }

  await writeAuditLog(req, "job.created", "job_card", job.id, null, job);
  res.status(201).json(job);
});

// ── PATCH /jobs/:id ───────────────────────────────────────
router.patch("/:id", requirePermission("jobs.edit"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const existing = await db("job_cards").where({ id: req.params.id, tenant_id: tenantId }).first();
  if (!existing) { res.status(404).json({ error: "Job not found" }); return; }

  const allowed = ["title", "description", "quantity", "size", "colors_front", "colors_back",
    "paper_type", "finishing", "due_date", "machine_id", "assigned_operator_id",
    "quoted_price", "estimated_cost", "actual_cost",
    // Extended fields
    "order_type", "sheet_size", "sheet_count", "paper_gsm",
    "composing_date", "composing_amount", "plate_cost", "die_cost", "plate_source",
    "approved_rate", "hela_cost", "other_cost", "proof_required",
    "is_offset", "is_digital", "is_screen", "print_colors", "print_operator", "print_date",
    "is_numbering", "numbering_from", "numbering_to",
    "is_binding", "is_uv", "is_foil", "is_die_cutting", "is_half_cutting",
    "is_creasing", "is_pasting", "is_lamination", "is_folding", "is_gumming",
    "post_print_date", "binding_operator", "packing_operator",
    "advance_amount", "quotation_ref", "indent_number",
    "delivery_quantity", "challan_number", "challan_date"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  updates.updated_at = new Date();

  const [updated] = await db("job_cards").where({ id: req.params.id }).update(updates).returning("*");

  if (req.body.assigned_operator_id && req.body.assigned_operator_id !== existing.assigned_operator_id) {
    await notifyJobAssigned(tenantId, req.body.assigned_operator_id, updated.job_number, updated.title, updated.id);
  }

  await writeAuditLog(req, "job.updated", "job_card", req.params.id, existing, updated);
  res.json(updated);
});

// ── PATCH /jobs/:id/status ────────────────────────────────
router.patch("/:id/status", requirePermission("production.update_status"), async (req, res) => {
  const { status, notes } = req.body;
  const tenantId = req.user.tenantId!;
  const existing = await db("job_cards").where({ id: req.params.id, tenant_id: tenantId }).first();
  if (!existing) { res.status(404).json({ error: "Job not found" }); return; }

  const [updated] = await db("job_cards")
    .where({ id: req.params.id })
    .update({ status, updated_at: new Date(), completed_at: status === "delivered" ? new Date() : null })
    .returning("*");

  await db("job_status_history").insert({
    job_id: req.params.id,
    changed_by: req.user.id,
    from_status: existing.status,
    to_status: status,
    notes: notes ?? null,
  });

  await notifyJobStatusChanged(tenantId, existing.assigned_operator_id, existing.job_number, existing.title, status, existing.id);
  await writeAuditLog(req, "job.status_changed", "job_card", req.params.id, { status: existing.status }, { status });
  res.json(updated);
});

// ── DELETE /jobs/:id ──────────────────────────────────────
router.delete("/:id", requirePermission("jobs.delete"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const existing = await db("job_cards").where({ id: req.params.id, tenant_id: tenantId }).first();
  if (!existing) { res.status(404).json({ error: "Job not found" }); return; }
  await db("job_cards").where({ id: req.params.id }).delete();
  await writeAuditLog(req, "job.deleted", "job_card", req.params.id, existing, null);
  res.status(204).send();
});

export default router;
