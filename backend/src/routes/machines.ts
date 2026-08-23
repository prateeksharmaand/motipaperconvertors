import { Router } from "express";
import { z } from "zod";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";
import { parseListParams, paginate, applySearch } from "../lib/queryBuilder.js";

const router = Router();
router.use(requireTenant);

const MACHINE_SORT_COLS = ["name", "type", "status", "created_at"];

const MachineSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  model: z.string().optional(),
  maxSheetWidthMm: z.number().int().positive().optional(),
  maxSheetHeightMm: z.number().int().positive().optional(),
  maxColors: z.number().int().positive().optional(),
  status: z.enum(["active", "maintenance", "inactive"]).default("active"),
  notes: z.string().optional(),
});

// GET /machines?page&limit&search&sortBy&sortDir&status&type
router.get("/", requirePermission("settings.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "name" });
  const tenantId = req.user.tenantId!;
  const { status, type } = req.query as Record<string, string>;

  let base = db("machines").where({ tenant_id: tenantId });
  let countQ = db("machines").where({ tenant_id: tenantId });

  if (status) { base = base.where({ status }); countQ = countQ.where({ status }); }
  if (type) { base = base.whereILike("type", `%${type}%`); countQ = countQ.whereILike("type", `%${type}%`); }

  base = applySearch(base, params.search, ["name", "type", "model"]);
  countQ = applySearch(countQ, params.search, ["name", "type", "model"]);

  res.json(await paginate(base, countQ, params, MACHINE_SORT_COLS));
});

router.post("/", requirePermission("settings.edit"), async (req, res) => {
  const parsed = MachineSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const [m] = await db("machines").insert({
    tenant_id: req.user.tenantId!, name: d.name, type: d.type ?? null,
    model: d.model ?? null, max_sheet_width_mm: d.maxSheetWidthMm ?? null,
    max_sheet_height_mm: d.maxSheetHeightMm ?? null, max_colors: d.maxColors ?? null,
    status: d.status, notes: d.notes ?? null,
  }).returning("*");
  res.status(201).json(m);
});

router.patch("/:id", requirePermission("settings.edit"), async (req, res) => {
  const parsed = MachineSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [updated] = await db("machines")
    .where({ id: req.params.id, tenant_id: req.user.tenantId! })
    .update({ ...parsed.data, updated_at: new Date() })
    .returning("*");
  if (!updated) { res.status(404).json({ error: "Machine not found" }); return; }
  res.json(updated);
});

router.delete("/:id", requirePermission("settings.edit"), async (req, res) => {
  const count = await db("machines").where({ id: req.params.id, tenant_id: req.user.tenantId! }).delete();
  if (!count) { res.status(404).json({ error: "Machine not found" }); return; }
  res.status(204).send();
});

router.get("/:id/queue", requirePermission("production.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "due_date" });
  const tenantId = req.user.tenantId!;

  const base = db("job_cards")
    .where({ machine_id: req.params.id, tenant_id: tenantId })
    .whereNotIn("status", ["delivered", "cancelled"])
    .leftJoin("clients", "job_cards.client_id", "clients.id")
    .select("job_cards.*", "clients.name as client_name");

  const countQ = db("job_cards")
    .where({ machine_id: req.params.id, tenant_id: tenantId })
    .whereNotIn("status", ["delivered", "cancelled"]);

  res.json(await paginate(base, countQ, params, ["due_date", "job_number", "status", "created_at"], "job_cards"));
});

export default router;
