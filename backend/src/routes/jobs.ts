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
      status: "enquiry",
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
    "quoted_price", "estimated_cost", "actual_cost"];
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
