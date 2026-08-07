import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import db from "../db/knex.js";
import { requirePermission, requireRole } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";
import { writeAuditLog } from "../middleware/auditLog.js";
import { parseListParams, paginate, applySearch } from "../lib/queryBuilder.js";
import type { Permission } from "../types/index.js";

const router = Router();
router.use(requireTenant);

const USER_SORT_COLS = ["name", "email", "role", "status", "last_login_at", "created_at"];

// GET /users?page&limit&search&sortBy&sortDir&role&status
router.get("/", requirePermission("staff.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "created_at" });
  const tenantId = req.user.tenantId!;
  const { role, status } = req.query as Record<string, string>;

  let base = db("users")
    .where({ tenant_id: tenantId })
    .select("id", "name", "email", "phone", "role", "status", "last_login_at", "created_at");
  let countQ = db("users").where({ tenant_id: tenantId });

  if (role) { base = base.where({ role }); countQ = countQ.where({ role }); }
  if (status) { base = base.where({ status }); countQ = countQ.where({ status }); }

  base = applySearch(base, params.search, ["name", "email", "phone"]);
  countQ = applySearch(countQ, params.search, ["name", "email", "phone"]);

  res.json(await paginate(base, countQ, params, USER_SORT_COLS));
});

const InviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(["sub_admin", "staff", "operator"]),
  permissions: z.array(z.string()).optional(),
});

router.post("/invite", requirePermission("staff.manage"), async (req, res) => {
  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { name, email, phone, role, permissions = [] } = parsed.data;
  const tenantId = req.user.tenantId!;

  if (role === "sub_admin" && req.user.role !== "owner" && req.user.role !== "super_admin") {
    res.status(403).json({ error: "Only the Owner can create sub-admins" });
    return;
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [user] = await db("users").insert({
    tenant_id: tenantId, name, email: email ?? null, phone: phone ?? null,
    role, status: "invited", invite_token: inviteToken, invite_expires_at: inviteExpiresAt,
  }).returning("*");

  if (role === "sub_admin" && permissions.length > 0) {
    await db("role_permissions").insert(
      permissions.map((p) => ({ user_id: user.id, tenant_id: tenantId, permission: p as Permission, granted_by: req.user.id })),
    );
  }

  await writeAuditLog(req, "user.invited", "user", user.id, null, { role, email, phone });
  res.status(201).json({ userId: user.id, inviteToken });
});

router.patch("/:id/permissions", requireRole("owner", "super_admin"), async (req, res) => {
  const { permissions } = req.body as { permissions: Permission[] };
  const tenantId = req.user.tenantId!;
  const targetUser = await db("users").where({ id: req.params.id, tenant_id: tenantId, role: "sub_admin" }).first();
  if (!targetUser) { res.status(404).json({ error: "Sub-admin not found" }); return; }

  await db.transaction(async (trx) => {
    await trx("role_permissions").where({ user_id: req.params.id, tenant_id: tenantId }).delete();
    if (permissions.length > 0) {
      await trx("role_permissions").insert(
        permissions.map((p) => ({ user_id: req.params.id, tenant_id: tenantId, permission: p, granted_by: req.user.id })),
      );
    }
  });

  await writeAuditLog(req, "user.permissions_updated", "user", req.params.id, null, { permissions });
  res.status(204).send();
});

router.patch("/:id/status", requireRole("owner", "super_admin"), async (req, res) => {
  const { status } = req.body as { status: "active" | "inactive" };
  const tenantId = req.user.tenantId!;
  const [updated] = await db("users")
    .where({ id: req.params.id, tenant_id: tenantId })
    .update({ status, updated_at: new Date() })
    .returning("*");
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  await writeAuditLog(req, "user.status_changed", "user", req.params.id, null, { status });
  res.status(204).send();
});

export default router;
