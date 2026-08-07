import { Router } from "express";
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
