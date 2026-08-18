import type { Request } from "express";
import db from "../db/knex.js";
import { randomUUID } from "crypto";

// ── Taxonomy constants ────────────────────────────────────
export const Category = {
  AUTH:      "AUTH",
  USER:      "USER",
  JOB:       "JOB",
  QUOTATION: "QUOTATION",
  BILLING:   "BILLING",
  INVENTORY: "INVENTORY",
  DELIVERY:  "DELIVERY",
  PROOF:     "PROOF",
  SETTINGS:  "SETTINGS",
  SYSTEM:    "SYSTEM",
  SECURITY:  "SECURITY",
} as const;

export const Action = {
  // Auth
  LOGIN:            "LOGIN",
  LOGOUT:           "LOGOUT",
  LOGIN_FAILED:     "LOGIN_FAILED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  TOKEN_REFRESHED:  "TOKEN_REFRESHED",
  SESSION_EXPIRED:  "SESSION_EXPIRED",
  // CRUD
  CREATED:  "CREATED",
  VIEWED:   "VIEWED",
  UPDATED:  "UPDATED",
  DELETED:  "DELETED",
  // Workflow
  STATUS_CHANGED:   "STATUS_CHANGED",
  ASSIGNED:         "ASSIGNED",
  REASSIGNED:       "REASSIGNED",
  PUBLISHED:        "PUBLISHED",
  APPROVED:         "APPROVED",
  REJECTED:         "REJECTED",
  // User management
  USER_CREATED:       "USER_CREATED",
  USER_UPDATED:       "USER_UPDATED",
  USER_DEACTIVATED:   "USER_DEACTIVATED",
  USER_DELETED:       "USER_DELETED",
  PERMISSION_CHANGED: "PERMISSION_CHANGED",
  PASSWORD_RESET:     "PASSWORD_RESET",
  // Files
  EXPORTED: "EXPORTED",
  IMPORTED: "IMPORTED",
  // Config
  CONFIG_UPDATED: "CONFIG_UPDATED",
  // Security
  PERMISSION_DENIED:  "PERMISSION_DENIED",
  UNAUTHORIZED:       "UNAUTHORIZED",
  // Bulk
  BULK_UPDATED: "BULK_UPDATED",
} as const;

export const Operation = {
  CREATE: "CREATE",
  READ:   "READ",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

export const Source = {
  WEB:        "WEB",
  MOBILE:     "MOBILE",
  API:        "API",
  SYSTEM:     "SYSTEM",
  BACKGROUND: "BACKGROUND",
} as const;

// ── Sensitive field masking ───────────────────────────────
const SENSITIVE_KEYS = new Set([
  "password", "password_hash", "token", "access_token", "refresh_token",
  "secret", "api_key", "apiKey", "jwt", "otp", "pin", "cvv", "card_number",
]);

function maskSensitive(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "********" : maskSensitive(v);
  }
  return result;
}

// ── Diff helper ───────────────────────────────────────────
export function diffFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return [];
  return Object.keys({ ...before, ...after }).filter(k => {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) return false;
    return JSON.stringify(before[k]) !== JSON.stringify(after[k]);
  });
}

// ── Main event interface ──────────────────────────────────
export interface ActivityEvent {
  // required
  category: string;
  action: string;
  // identity (auto-extracted from req if provided)
  tenantId?: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  // action detail
  module?: string;
  feature?: string;
  operation?: string;
  description?: string;
  // entity
  entityType?: string;
  entityId?: string;
  entityName?: string;
  // change tracking
  before?: object | null;
  after?: object | null;
  changedFields?: string[];
  // request context
  ipAddress?: string;
  userAgent?: string;
  source?: string;
  requestId?: string;
  httpMethod?: string;
  httpPath?: string;
  responseStatus?: number;
  durationMs?: number;
  // result
  status?: "SUCCESS" | "FAILED" | "DENIED";
  errorMessage?: string;
  // extra
  metadata?: object;
}

// ── Logger ────────────────────────────────────────────────

/** Extract activity context from an Express request. */
export function fromRequest(req: Request): Partial<ActivityEvent> {
  const user = req.user;
  return {
    tenantId:    user?.tenantId ?? null,
    userId:      user?.id ?? null,
    userRole:    user?.role ?? null,
    ipAddress:   (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? undefined,
    userAgent:   (req.headers["user-agent"]) ?? undefined,
    source:      Source.WEB,
    requestId:   (req.headers["x-request-id"] as string) ?? randomUUID(),
    httpMethod:  req.method,
    httpPath:    req.path,
  };
}

/**
 * Log an activity event. Call this after any significant action.
 * Fails silently to avoid breaking business logic — unless `critical: true`.
 */
export async function logActivity(
  event: ActivityEvent,
  req?: Request,
): Promise<void> {
  try {
    const reqCtx = req ? fromRequest(req) : {};

    const before = event.before ? maskSensitive(event.before) : null;
    const after  = event.after  ? maskSensitive(event.after)  : null;

    const changedFields = event.changedFields
      ?? (event.before && event.after
          ? diffFields(event.before as Record<string, unknown>, event.after as Record<string, unknown>)
          : []);

    await db("activity_logs").insert({
      tenant_id:      event.tenantId   ?? reqCtx.tenantId   ?? null,
      user_id:        event.userId     ?? reqCtx.userId     ?? null,
      user_name:      event.userName   ?? null,
      user_email:     event.userEmail  ?? null,
      user_role:      event.userRole   ?? reqCtx.userRole   ?? null,
      category:       event.category,
      action:         event.action,
      module:         event.module     ?? null,
      feature:        event.feature    ?? null,
      operation:      event.operation  ?? null,
      description:    event.description ?? null,
      entity_type:    event.entityType ?? null,
      entity_id:      event.entityId   ?? null,
      entity_name:    event.entityName ?? null,
      before:         before ? JSON.stringify(before) : null,
      after:          after  ? JSON.stringify(after)  : null,
      changed_fields: changedFields.length ? changedFields : null,
      ip_address:     event.ipAddress  ?? reqCtx.ipAddress  ?? null,
      user_agent:     event.userAgent  ?? reqCtx.userAgent  ?? null,
      source:         event.source     ?? reqCtx.source     ?? Source.WEB,
      request_id:     event.requestId  ?? reqCtx.requestId  ?? null,
      http_method:    event.httpMethod ?? reqCtx.httpMethod ?? null,
      http_path:      event.httpPath   ?? reqCtx.httpPath   ?? null,
      response_status: event.responseStatus ?? null,
      duration_ms:    event.durationMs ?? null,
      status:         event.status     ?? "SUCCESS",
      error_message:  event.errorMessage ?? null,
      metadata:       event.metadata ? JSON.stringify(event.metadata) : null,
    });
  } catch (err) {
    // Never crash the main request due to logging failure
    console.error("[ActivityLogger] Failed to write activity log:", err);
  }
}

/**
 * Convenience wrapper: enriches event from req automatically.
 */
export async function log(req: Request, event: Omit<ActivityEvent, "tenantId" | "userId" | "userRole">): Promise<void> {
  await logActivity(event, req);
}
