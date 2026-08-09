import { Router } from "express";
import { z } from "zod";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";

const router = Router();
router.use(requireTenant);

const NameSchema = z.object({ name: z.string().min(1) });

// ── Job Types ─────────────────────────────────────────────────────────────────

router.get("/job-types", requirePermission("settings.edit"), async (req, res) => {
  const rows = await db("tenant_settings")
    .where({ tenant_id: req.user.tenantId!, key: "job_type" })
    .orderBy("created_at", "asc")
    .select("id", "value as name", "tenant_id");
  res.json(rows);
});

router.post("/job-types", requirePermission("settings.edit"), async (req, res) => {
  const parsed = NameSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [row] = await db("tenant_settings")
    .insert({ tenant_id: req.user.tenantId!, key: "job_type", value: parsed.data.name })
    .returning(["id", "value as name", "tenant_id"]);
  res.status(201).json(row);
});

router.delete("/job-types/:id", requirePermission("settings.edit"), async (req, res) => {
  await db("tenant_settings")
    .where({ id: req.params.id, tenant_id: req.user.tenantId!, key: "job_type" })
    .delete();
  res.json({ ok: true });
});

// ── Print Colors ──────────────────────────────────────────────────────────────

router.get("/print-colors", requirePermission("settings.edit"), async (req, res) => {
  const rows = await db("tenant_settings")
    .where({ tenant_id: req.user.tenantId!, key: "print_color" })
    .orderBy("created_at", "asc")
    .select("id", "value as name", "tenant_id");
  res.json(rows);
});

router.post("/print-colors", requirePermission("settings.edit"), async (req, res) => {
  const parsed = NameSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [row] = await db("tenant_settings")
    .insert({ tenant_id: req.user.tenantId!, key: "print_color", value: parsed.data.name })
    .returning(["id", "value as name", "tenant_id"]);
  res.status(201).json(row);
});

router.delete("/print-colors/:id", requirePermission("settings.edit"), async (req, res) => {
  await db("tenant_settings")
    .where({ id: req.params.id, tenant_id: req.user.tenantId!, key: "print_color" })
    .delete();
  res.json({ ok: true });
});

export default router;
