import { Router } from "express";
import { z } from "zod";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";
import { parseListParams, paginate, applySearch } from "../lib/queryBuilder.js";

const router = Router();
router.use(requireTenant);

const CLIENT_SORT_COLS = ["name", "company_name", "city", "created_at"];

const ClientSchema = z.object({
  name: z.string().min(1),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  gstin: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
  notes: z.string().optional(),
});

// GET /clients?page&limit&search&sortBy&sortDir&status&city
router.get("/", requirePermission("clients.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "name" });
  const tenantId = req.user.tenantId!;
  const { status, city } = req.query as Record<string, string>;

  let base = db("clients").where({ tenant_id: tenantId });
  let countQ = db("clients").where({ tenant_id: tenantId });

  if (status) { base = base.where({ status }); countQ = countQ.where({ status }); }
  if (city) { base = base.whereILike("city", `%${city}%`); countQ = countQ.whereILike("city", `%${city}%`); }

  base = applySearch(base, params.search, ["name", "company_name", "phone", "email", "gstin"]);
  countQ = applySearch(countQ, params.search, ["name", "company_name", "phone", "email", "gstin"]);

  res.json(await paginate(base, countQ, params, CLIENT_SORT_COLS));
});

router.get("/:id", requirePermission("clients.view"), async (req, res) => {
  const client = await db("clients").where({ id: req.params.id, tenant_id: req.user.tenantId! }).first();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(client);
});

router.post("/", requirePermission("clients.edit"), async (req, res) => {
  const parsed = ClientSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const [client] = await db("clients").insert({
    tenant_id: req.user.tenantId!,
    name: d.name, company_name: d.companyName ?? null, phone: d.phone ?? null,
    email: d.email ?? null, address: d.address ?? null, city: d.city ?? null,
    gstin: d.gstin ?? null, credit_limit: d.creditLimit ?? 0, notes: d.notes ?? null,
  }).returning("*");
  res.status(201).json(client);
});

router.patch("/:id", requirePermission("clients.edit"), async (req, res) => {
  const parsed = ClientSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [updated] = await db("clients")
    .where({ id: req.params.id, tenant_id: req.user.tenantId! })
    .update({ ...parsed.data, updated_at: new Date() })
    .returning("*");
  if (!updated) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(updated);
});

router.delete("/:id", requirePermission("clients.edit"), async (req, res) => {
  const existing = await db("clients").where({ id: req.params.id, tenant_id: req.user.tenantId! }).first();
  if (!existing) { res.status(404).json({ error: "Client not found" }); return; }
  await db("clients").where({ id: req.params.id }).delete();
  res.status(204).send();
});

export default router;
