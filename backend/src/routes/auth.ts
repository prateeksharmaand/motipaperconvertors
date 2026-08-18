import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import db from "../db/knex.js";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt.js";
import { authenticate } from "../middleware/authenticate.js";
import { logActivity, Category, Action, Source } from "../lib/activityLogger.js";
import type { Role } from "../types/index.js";

const router = Router();

// ── POST /api/v1/auth/register ────────────────────────────
// Creates a new tenant + owner account in one shot
const RegisterSchema = z.object({
  pressName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  city: z.string().optional(),
});

router.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { pressName, ownerName, email, phone, password, city } = parsed.data;

  const existing = await db("users").where({ email }).first();
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const slug = pressName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const passwordHash = await bcrypt.hash(password, 12);

  await db.transaction(async (trx) => {
    const [tenant] = await trx("tenants").insert({
      name: pressName,
      slug: `${slug}-${Date.now()}`,
      email,
      phone,
      city,
    }).returning("*");

    const [user] = await trx("users").insert({
      tenant_id: tenant.id,
      name: ownerName,
      email,
      phone,
      password_hash: passwordHash,
      role: "owner",
      status: "active",
    }).returning("*");

    // Seed counter row for this tenant
    await trx("tenant_job_counters").insert({ tenant_id: tenant.id });

    const accessToken = signAccess({ sub: user.id, tenantId: tenant.id, role: "owner" });
    const refreshToken = signRefresh({ sub: user.id, tenantId: tenant.id, role: "owner" });

    await trx("refresh_tokens").insert({
      user_id: user.id,
      token_hash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    res.status(201).json({ accessToken, refreshToken, tenantId: tenant.id, userId: user.id });
  });
});

// ── POST /api/v1/auth/login ───────────────────────────────
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  const user = await db("users").where({ email }).whereNull("deleted_at").first();
  if (!user || !user.password_hash) {
    await logActivity({ category: Category.AUTH, action: Action.LOGIN_FAILED, module: "Auth", description: `Failed login attempt for ${email}`, status: "FAILED", ipAddress: req.ip ?? undefined, userAgent: req.headers["user-agent"] ?? undefined, source: Source.WEB, metadata: { email } });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await logActivity({ category: Category.AUTH, action: Action.LOGIN_FAILED, module: "Auth", description: `Failed login attempt for ${email}`, status: "FAILED", tenantId: user.tenant_id, userId: user.id, userName: user.name, userEmail: user.email, userRole: user.role, ipAddress: req.ip ?? undefined, userAgent: req.headers["user-agent"] ?? undefined, source: Source.WEB });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.status !== "active") {
    res.status(403).json({ error: "Account is not active" });
    return;
  }

  await db("users").where({ id: user.id }).update({ last_login_at: new Date() });

  const accessToken = signAccess({ sub: user.id, tenantId: user.tenant_id, role: user.role });
  const refreshToken = signRefresh({ sub: user.id, tenantId: user.tenant_id, role: user.role });

  await db("refresh_tokens").insert({
    user_id: user.id,
    token_hash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    device_info: req.headers["user-agent"] ?? null,
  });

  // Log successful login
  await logActivity({ category: Category.AUTH, action: Action.LOGIN, module: "Auth", description: `${user.name} logged in`, tenantId: user.tenant_id, userId: user.id, userName: user.name, userEmail: user.email, userRole: user.role, ipAddress: req.ip ?? undefined, userAgent: req.headers["user-agent"] ?? undefined, source: Source.WEB });

  res.json({ accessToken, refreshToken });
});

// ── POST /api/v1/auth/refresh ─────────────────────────────
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken required" });
    return;
  }

  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const stored = await db("refresh_tokens").where({ token_hash: tokenHash }).first();

  if (!stored || stored.revoked_at || new Date(stored.expires_at) < new Date()) {
    res.status(401).json({ error: "Refresh token not recognised or revoked" });
    return;
  }

  // Rotate: revoke old, issue new
  await db("refresh_tokens").where({ id: stored.id }).update({ revoked_at: new Date() });

  const newAccess = signAccess({ sub: payload.sub, tenantId: payload.tenantId, role: payload.role });
  const newRefresh = signRefresh({ sub: payload.sub, tenantId: payload.tenantId, role: payload.role });

  await db("refresh_tokens").insert({
    user_id: payload.sub,
    token_hash: crypto.createHash("sha256").update(newRefresh).digest("hex"),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  res.json({ accessToken: newAccess, refreshToken: newRefresh });
});

// ── GET /api/v1/auth/me ───────────────────────────────────
router.get("/me", authenticate, (req, res) => {
  res.json({
    id: req.user.id,
    role: req.user.role,
    tenantId: req.user.tenantId,
    permissions: req.user.permissions ?? [],
  });
});

// ── POST /api/v1/auth/logout ──────────────────────────────
router.post("/logout", authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await db("refresh_tokens").where({ token_hash: tokenHash }).update({ revoked_at: new Date() });
  }
  await logActivity({ category: Category.AUTH, action: Action.LOGOUT, module: "Auth", description: "User logged out", tenantId: req.user.tenantId, userId: req.user.id, userRole: req.user.role, ipAddress: req.ip ?? undefined, source: Source.WEB });
  res.status(204).send();
});

// ── POST /api/v1/auth/invite/accept ──────────────────────
// Staff / sub-admin accept their invite and set a password
const AcceptInviteSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

router.post("/invite/accept", async (req, res) => {
  const parsed = AcceptInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { token, password } = parsed.data;

  const user = await db("users").where({ invite_token: token }).first();
  if (!user || !user.invite_expires_at || new Date(user.invite_expires_at) < new Date()) {
    res.status(400).json({ error: "Invalid or expired invite token" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db("users").where({ id: user.id }).update({
    password_hash: passwordHash,
    status: "active",
    invite_token: null,
    invite_expires_at: null,
  });

  const accessToken = signAccess({ sub: user.id, tenantId: user.tenant_id, role: user.role as Role });
  const refreshToken = signRefresh({ sub: user.id, tenantId: user.tenant_id, role: user.role as Role });

  res.json({ accessToken, refreshToken });
});

// ── PATCH /api/v1/auth/fcm-token ─────────────────────────
// Mobile app registers/updates its FCM device token
router.patch("/fcm-token", authenticate, async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) {
    res.status(400).json({ error: "fcmToken required" });
    return;
  }
  await db("users").where({ id: req.user.id }).update({ fcm_token: fcmToken });
  res.status(204).send();
});

export default router;
