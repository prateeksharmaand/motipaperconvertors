import type { Request, Response, NextFunction } from "express";
import db from "../db/knex.js";

// Call this helper inside route handlers after a successful mutation.
// Not a middleware — keeps audit writes explicit and close to business logic.
export async function writeAuditLog(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  before?: object | null,
  after?: object | null,
): Promise<void> {
  if (!req.user.tenantId) return; // no audit log for super-admin platform actions here

  await db("audit_log").insert({
    tenant_id: req.user.tenantId,
    user_id: req.user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before: before ? JSON.stringify(before) : null,
    after: after ? JSON.stringify(after) : null,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"] ?? null,
  });
}
