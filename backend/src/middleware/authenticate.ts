import type { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../lib/jwt.js";
import db from "../db/knex.js";
import type { Permission } from "../types/index.js";

// Verifies JWT, loads user permissions from DB, attaches req.user
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = verifyAccess(token);
  } catch {
    res.status(401).json({ error: "Token invalid or expired" });
    return;
  }

  // Load permissions for sub_admins; owners/super_admins get everything implicitly
  let permissions: Permission[] = [];
  if (payload.role === "sub_admin" && payload.tenantId) {
    const rows = await db("role_permissions")
      .where({ user_id: payload.sub, tenant_id: payload.tenantId })
      .select("permission");
    permissions = rows.map((r: { permission: Permission }) => r.permission);
  }

  req.user = {
    id: payload.sub,
    tenantId: payload.tenantId,
    role: payload.role,
    permissions,
  };

  next();
}
