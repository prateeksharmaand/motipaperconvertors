import { Router } from "express";
import { z } from "zod";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";
import { writeAuditLog } from "../middleware/auditLog.js";
import { nextNumber } from "../lib/jobCounter.js";
import { parseListParams, paginate, applySearch } from "../lib/queryBuilder.js";

const router = Router();
router.use(requireTenant);

const QUOTATION_SORT_COLS = ["quotation_number", "total", "status", "created_at"];

const FinishingItemSchema = z.object({ name: z.string(), amount: z.number().min(0) });

const QuotationSchema = z.object({
  jobId: z.string().uuid(),
  paperCost: z.number().min(0).default(0),
  sheetsRequired: z.number().int().optional(),
  wastagePercent: z.number().min(0).max(100).optional(),
  plateCount: z.number().int().optional(),
  plateCost: z.number().min(0).default(0),
  printingCost: z.number().min(0).default(0),
  finishingItems: z.array(FinishingItemSchema).default([]),
  marginPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).default(0),
  gstPercent: z.number().min(0).max(30).default(18),
  notes: z.string().optional(),
});

function calcTotals(data: z.infer<typeof QuotationSchema>) {
  const finishingTotal = data.finishingItems.reduce((s, i) => s + i.amount, 0);
  const rawCost = data.paperCost + data.plateCost + data.printingCost + finishingTotal;
  const withMargin = data.marginPercent ? rawCost * (1 + data.marginPercent / 100) : rawCost;
  const subTotal = withMargin - data.discountAmount;
  const gstAmount = (subTotal * data.gstPercent) / 100;
  const total = subTotal + gstAmount;
  return { subTotal, gstAmount, total };
}

// GET /quotations?page&limit&search&sortBy&sortDir&jobId&status
router.get("/", requirePermission("quotation.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "created_at" });
  const tenantId = req.user.tenantId!;
  const { jobId, status } = req.query as Record<string, string>;

  let base = db("quotations")
    .where({ "quotations.tenant_id": tenantId })
    .leftJoin("job_cards", "quotations.job_id", "job_cards.id")
    .select("quotations.*", "job_cards.title as job_title", "job_cards.job_number");

  let countQ = db("quotations")
    .where({ "quotations.tenant_id": tenantId })
    .leftJoin("job_cards", "quotations.job_id", "job_cards.id");

  if (jobId) { base = base.where({ "quotations.job_id": jobId }); countQ = countQ.where({ "quotations.job_id": jobId }); }
  if (status) { base = base.where({ "quotations.status": status }); countQ = countQ.where({ "quotations.status": status }); }

  base = applySearch(base, params.search, ["job_cards.title", "quotations.notes"]);
  countQ = applySearch(countQ, params.search, ["job_cards.title", "quotations.notes"]);

  res.json(await paginate(base, countQ, params, QUOTATION_SORT_COLS, "quotations"));
});

router.get("/:id", requirePermission("quotation.view"), async (req, res) => {
  const q = await db("quotations").where({ id: req.params.id, tenant_id: req.user.tenantId! }).first();
  if (!q) { res.status(404).json({ error: "Quotation not found" }); return; }
  res.json(q);
});

router.post("/", requirePermission("quotation.create"), async (req, res) => {
  const parsed = QuotationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const tenantId = req.user.tenantId!;
  const data = parsed.data;

  const job = await db("job_cards").where({ id: data.jobId, tenant_id: tenantId }).first();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const { subTotal, gstAmount, total } = calcTotals(data);

  const quotation = await db.transaction(async (trx) => {
    const quotationNumber = await nextNumber(trx, tenantId, "last_quotation_number");
    const [inserted] = await trx("quotations").insert({
      tenant_id: tenantId, quotation_number: quotationNumber, job_id: data.jobId,
      created_by: req.user.id, paper_cost: data.paperCost, sheets_required: data.sheetsRequired ?? null,
      wastage_percent: data.wastagePercent ?? null, plate_count: data.plateCount ?? null,
      plate_cost: data.plateCost, printing_cost: data.printingCost,
      finishing_items: JSON.stringify(data.finishingItems), margin_percent: data.marginPercent ?? null,
      discount_amount: data.discountAmount, gst_percent: data.gstPercent,
      gst_amount: gstAmount, sub_total: subTotal, total, notes: data.notes ?? null,
    }).returning("*");
    return inserted;
  });

  if (job.status === "enquiry") {
    await db("job_cards").where({ id: job.id }).update({ status: "quotation", quoted_price: total, estimated_cost: total });
  }

  await writeAuditLog(req, "quotation.created", "quotation", quotation.id, null, quotation);
  res.status(201).json(quotation);
});

router.patch("/:id", requirePermission("quotation.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const existing = await db("quotations").where({ id: req.params.id, tenant_id: tenantId }).first();
  if (!existing) { res.status(404).json({ error: "Quotation not found" }); return; }

  const rateFields = ["paperCost", "plateCost", "printingCost", "finishingItems", "marginPercent", "gstPercent"];
  const touchesRates = rateFields.some((f) => req.body[f] !== undefined);
  if (touchesRates && !req.user.permissions.includes("quotation.edit_rates") && req.user.role !== "owner" && req.user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden: quotation.edit_rates required" });
    return;
  }

  const merged = QuotationSchema.partial().omit({ jobId: true }).safeParse(req.body);
  if (!merged.success) { res.status(400).json({ error: merged.error.flatten() }); return; }

  const patch = merged.data;
  const full = { ...existing, ...patch };
  const { subTotal, gstAmount, total } = calcTotals(full as z.infer<typeof QuotationSchema>);
  const updates: Record<string, unknown> = { ...patch, sub_total: subTotal, gst_amount: gstAmount, total, updated_at: new Date() };
  if (patch.finishingItems) updates.finishing_items = JSON.stringify(patch.finishingItems);

  const [updated] = await db("quotations").where({ id: req.params.id }).update(updates).returning("*");
  await writeAuditLog(req, "quotation.updated", "quotation", req.params.id, existing, updated);
  res.json(updated);
});

export default router;
