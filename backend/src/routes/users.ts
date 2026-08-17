import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
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
    .whereNull("deleted_at")
    .select("id", "name", "email", "phone", "role", "status", "staff_type", "last_login_at", "created_at");
  let countQ = db("users").where({ tenant_id: tenantId }).whereNull("deleted_at");

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

const CreateStaffSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  staffType: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  role: z.enum(["operator", "sub_admin"]).optional().default("operator"),
});

// POST /users — direct create with password (for operator/staff accounts)
router.post("/", requirePermission("staff.manage"), async (req, res) => {
  const parsed = CreateStaffSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { name, email, password, staffType, status, role } = parsed.data;
  const tenantId = req.user.tenantId!;

  // Only owner can create sub_admins
  if (role === "sub_admin" && req.user.role !== "owner" && req.user.role !== "super_admin") {
    res.status(403).json({ error: "Only the Owner can create sub-admins" }); return;
  }

  const existing = await db("users").where({ tenant_id: tenantId, email }).whereNull("deleted_at").first();
  if (existing) { res.status(409).json({ error: "A user with this email already exists" }); return; }

  const password_hash = await bcrypt.hash(password, 10);
  const [user] = await db("users").insert({
    tenant_id: tenantId,
    name,
    email,
    password_hash,
    role: role ?? "operator",
    status,
    staff_type: staffType ?? null,
  }).returning(["id", "name", "email", "role", "status", "staff_type"]);

  await writeAuditLog(req, "user.created", "user", user.id, null, { role, email });
  res.status(201).json(user);
});

const UpdateStaffSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  staff_type: z.string().nullable().optional(),
  status: z.enum(["active", "inactive", "invited"]).optional(),
});

// PATCH /users/:id — general update for staff/operator fields
router.patch("/:id", requirePermission("staff.manage"), async (req, res) => {
  const parsed = UpdateStaffSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const tenantId = req.user.tenantId!;
  const target = await db("users").where({ id: req.params.id, tenant_id: tenantId }).first();
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.staff_type !== undefined) updates.staff_type = parsed.data.staff_type;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [updated] = await db("users").where({ id: req.params.id }).update(updates).returning(["id", "name", "email", "role", "status", "staff_type"]);
  await writeAuditLog(req, "user.updated", "user", req.params.id, target, updated);
  res.json(updated);
});

router.get("/:id/permissions", requireRole("owner", "super_admin"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const rows = await db("role_permissions").where({ user_id: req.params.id, tenant_id: tenantId }).select("permission");
  res.json(rows.map((r: { permission: string }) => r.permission));
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

// PATCH /users/:id/password — owner changes any user's password
router.patch("/:id/password", requireRole("owner", "super_admin"), async (req, res) => {
  const { password } = req.body as { password: string };
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" }); return;
  }
  const tenantId = req.user.tenantId!;
  const target = await db("users").where({ id: req.params.id, tenant_id: tenantId }).whereNull("deleted_at").first();
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  const password_hash = await bcrypt.hash(password, 10);
  await db("users").where({ id: req.params.id }).update({ password_hash, updated_at: new Date() });
  await writeAuditLog(req, "user.password_changed", "user", req.params.id, null, { changed_by: req.user.id });
  res.status(204).send();
});

// DELETE /users/:id — soft delete (only allowed if user is inactive)
router.delete("/:id", requirePermission("staff.manage"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const target = await db("users").where({ id: req.params.id, tenant_id: tenantId }).whereNull("deleted_at").first();
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.status !== "inactive") {
    res.status(400).json({ error: "Only inactive staff members can be deleted. Deactivate first." });
    return;
  }
  await db("users").where({ id: req.params.id, tenant_id: tenantId }).update({ deleted_at: new Date() });
  await writeAuditLog(req, "user.deleted", "user", req.params.id, target, null);
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
