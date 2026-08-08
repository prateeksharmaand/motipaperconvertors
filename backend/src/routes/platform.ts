import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import db from "../db/knex.js";
import { requireRole } from "../middleware/requirePermission.js";
import { parseListParams, paginate, applySearch } from "../lib/queryBuilder.js";

const router = Router();
router.use(requireRole("super_admin"));

const TENANT_SORT_COLS = ["name", "slug", "plan", "status", "created_at"];

// GET /platform/tenants?page&limit&search&sortBy&sortDir&status&plan
router.get("/tenants", async (req, res) => {
  const params = parseListParams(req, { sortBy: "created_at" });
  const { status, plan } = req.query as Record<string, string>;

  let base = db("tenants");
  let countQ = db("tenants");

  if (status) { base = base.where({ status }); countQ = countQ.where({ status }); }
  if (plan)   { base = base.where({ plan });   countQ = countQ.where({ plan }); }

  base = applySearch(base, params.search, ["name", "slug", "email", "city"]);
  countQ = applySearch(countQ, params.search, ["name", "slug", "email", "city"]);

  res.json(await paginate(base, countQ, params, TENANT_SORT_COLS));
});

const CreateTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  city: z.string().optional(),
  plan: z.enum(["free", "starter", "pro"]).default("free"),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
});

router.post("/tenants", async (req, res) => {
  const parsed = CreateTenantSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;

  const existing = await db("tenants").where({ slug: d.slug }).first();
  if (existing) { res.status(409).json({ error: "Slug already taken" }); return; }

  const result = await db.transaction(async (trx) => {
    const [tenant] = await trx("tenants").insert({
      name: d.name, slug: d.slug, email: d.email || null, phone: d.phone ?? null,
      city: d.city ?? null, plan: d.plan, status: "active",
    }).returning("*");

    const passwordHash = await bcrypt.hash(d.ownerPassword, 12);
    const [owner] = await trx("users").insert({
      tenant_id: tenant.id, name: d.ownerName, email: d.ownerEmail,
      password_hash: passwordHash, role: "owner", status: "active",
    }).returning("*");

    return { tenant, owner };
  });

  res.status(201).json(result.tenant);
});

router.patch("/tenants/:id/status", async (req, res) => {
  const { status } = req.body as { status: "active" | "suspended" };
  const [updated] = await db("tenants")
    .where({ id: req.params.id })
    .update({ status, updated_at: new Date() })
    .returning("*");
  if (!updated) { res.status(404).json({ error: "Tenant not found" }); return; }
  res.json(updated);
});

export default router;
