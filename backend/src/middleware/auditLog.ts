import type { Request } from "express";
import db from "../db/knex.js";
import { logActivity, Category, Action, Operation } from "../lib/activityLogger.js";

// Legacy helper — kept for backward compat. New code should call logActivity() directly.
export async function writeAuditLog(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  before?: object | null,
  after?: object | null,
): Promise<void> {
  const tenantId = req.user?.tenantId;
  if (!tenantId && !req.user?.id) return;

  // Write to legacy audit_log table
  try {
    if (tenantId) {
      await db("audit_log").insert({
        tenant_id: tenantId,
        user_id:   req.user.id,
        action,
        entity_type: entityType,
        entity_id:   entityId,
        before:      before ? JSON.stringify(before) : null,
        after:       after  ? JSON.stringify(after)  : null,
        ip_address:  req.ip,
        user_agent:  req.headers["user-agent"] ?? null,
      });
    }
  } catch { /* ignore legacy failures */ }

  // Fetch user name/email snapshot (non-blocking)
  let userName: string | null = null;
  let userEmail: string | null = null;
  try {
    if (req.user?.id) {
      const u = await db("users").where({ id: req.user.id }).first("name", "email");
      userName = u?.name ?? null;
      userEmail = u?.email ?? null;
    }
  } catch { /* ignore */ }

  // Also write enriched entry to activity_logs
  const parsed = parseAction(action);
  await logActivity({
    tenantId:    tenantId ?? null,
    userId:      req.user?.id ?? null,
    userName,
    userEmail,
    userRole:    req.user?.role ?? null,
    category:    parsed.category,
    action:      parsed.activityAction,
    module:      parsed.module,
    operation:   parsed.operation,
    description: buildDescription(action, entityType, entityId),
    entityType,
    entityId,
    before,
    after,
  }, req);
}

// Map legacy dot-notation action strings to activity taxonomy
function parseAction(action: string): { category: string; activityAction: string; module: string; operation: string } {
  const MAP: Record<string, { category: string; activityAction: string; module: string; operation: string }> = {
    "job.created":              { category: Category.JOB,       activityAction: Action.CREATED,        module: "Job Cards",   operation: Operation.CREATE },
    "job.updated":              { category: Category.JOB,       activityAction: Action.UPDATED,        module: "Job Cards",   operation: Operation.UPDATE },
    "job.deleted":              { category: Category.JOB,       activityAction: Action.DELETED,        module: "Job Cards",   operation: Operation.DELETE },
    "job.status_changed":       { category: Category.JOB,       activityAction: Action.STATUS_CHANGED, module: "Job Cards",   operation: Operation.UPDATE },
    "invoice.created":          { category: Category.BILLING,   activityAction: Action.CREATED,        module: "Billing",     operation: Operation.CREATE },
    "invoice.updated":          { category: Category.BILLING,   activityAction: Action.UPDATED,        module: "Billing",     operation: Operation.UPDATE },
    "invoice.status_changed":   { category: Category.BILLING,   activityAction: Action.STATUS_CHANGED, module: "Billing",     operation: Operation.UPDATE },
    "payment.recorded":         { category: Category.BILLING,   activityAction: Action.CREATED,        module: "Billing",     operation: Operation.CREATE },
    "quotation.created":        { category: Category.QUOTATION, activityAction: Action.CREATED,        module: "Quotations",  operation: Operation.CREATE },
    "quotation.updated":        { category: Category.QUOTATION, activityAction: Action.UPDATED,        module: "Quotations",  operation: Operation.UPDATE },
    "proof.actioned":           { category: Category.PROOF,     activityAction: Action.UPDATED,        module: "Proofs",      operation: Operation.UPDATE },
    "user.created":             { category: Category.USER,      activityAction: Action.USER_CREATED,   module: "Staff",       operation: Operation.CREATE },
    "user.updated":             { category: Category.USER,      activityAction: Action.USER_UPDATED,   module: "Staff",       operation: Operation.UPDATE },
    "user.deleted":             { category: Category.USER,      activityAction: Action.USER_DELETED,   module: "Staff",       operation: Operation.DELETE },
    "user.invited":             { category: Category.USER,      activityAction: Action.USER_CREATED,   module: "Staff",       operation: Operation.CREATE },
    "user.status_changed":      { category: Category.USER,      activityAction: Action.USER_UPDATED,   module: "Staff",       operation: Operation.UPDATE },
    "user.permissions_updated": { category: Category.USER,      activityAction: Action.PERMISSION_CHANGED, module: "Staff",   operation: Operation.UPDATE },
    "user.password_changed":    { category: Category.USER,      activityAction: Action.PASSWORD_CHANGED, module: "Staff",     operation: Operation.UPDATE },
    "inventory.transaction":    { category: Category.INVENTORY, activityAction: Action.UPDATED,        module: "Inventory",   operation: Operation.UPDATE },
    "inventory.paper_rates_updated": { category: Category.INVENTORY, activityAction: Action.BULK_UPDATED, module: "Inventory", operation: Operation.UPDATE },
  };
  return MAP[action] ?? { category: Category.SYSTEM, activityAction: action.toUpperCase(), module: "System", operation: Operation.UPDATE };
}

function buildDescription(action: string, entityType: string, entityId: string): string {
  const labels: Record<string, string> = {
    "job.created": "Created job card",
    "job.updated": "Updated job card",
    "job.deleted": "Deleted job card",
    "job.status_changed": "Changed job card status",
    "invoice.created": "Created invoice",
    "invoice.updated": "Updated invoice",
    "invoice.status_changed": "Changed invoice status",
    "payment.recorded": "Recorded payment",
    "quotation.created": "Created quotation",
    "quotation.updated": "Updated quotation",
    "proof.actioned": "Actioned proof",
    "user.created": "Created user",
    "user.updated": "Updated user",
    "user.deleted": "Deleted user",
    "user.invited": "Invited user",
    "user.permissions_updated": "Updated user permissions",
    "user.password_changed": "Changed user password",
    "inventory.transaction": "Recorded inventory transaction",
    "inventory.paper_rates_updated": "Updated paper rates",
  };
  return labels[action] ?? `${action} on ${entityType} ${entityId}`;
}
