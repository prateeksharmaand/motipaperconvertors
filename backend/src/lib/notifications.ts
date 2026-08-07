import db from "../db/knex.js";
import { sendToToken, sendToTokens } from "./fcm.js";

// Fetch FCM tokens for given user IDs (filters out nulls)
async function tokensForUsers(userIds: string[]): Promise<string[]> {
  const rows = await db("users")
    .whereIn("id", userIds)
    .whereNotNull("fcm_token")
    .where("status", "active")
    .pluck("fcm_token");
  return rows as string[];
}

// Fetch owner + all active sub-admins + staff for a tenant
async function tenantStaffTokens(tenantId: string): Promise<string[]> {
  const rows = await db("users")
    .where({ tenant_id: tenantId, status: "active" })
    .whereNotNull("fcm_token")
    .pluck("fcm_token");
  return rows as string[];
}

// ── Notification events ───────────────────────────────────

export async function notifyJobAssigned(
  tenantId: string,
  operatorId: string,
  jobNumber: number,
  jobTitle: string,
  jobId: string,
): Promise<void> {
  const tokens = await tokensForUsers([operatorId]);
  await sendToTokens(tokens, {
    title: `Job #${jobNumber} assigned to you`,
    body: jobTitle,
    data: { type: "job_assigned", jobId, tenantId },
  });
}

export async function notifyProofNeedsApproval(
  tenantId: string,
  jobNumber: number,
  jobTitle: string,
  jobId: string,
): Promise<void> {
  // Notify owner + sub-admins with production.view permission
  const rows = await db("users")
    .where({ tenant_id: tenantId, status: "active" })
    .whereIn("role", ["owner", "sub_admin"])
    .whereNotNull("fcm_token")
    .pluck("fcm_token") as string[];

  await sendToTokens(rows, {
    title: `Proof ready for Job #${jobNumber}`,
    body: `${jobTitle} — awaiting approval`,
    data: { type: "proof_approval", jobId, tenantId },
  });
}

export async function notifyLowStock(
  tenantId: string,
  itemName: string,
  remaining: number,
  unit: string,
): Promise<void> {
  const tokens = await tenantStaffTokens(tenantId);
  await sendToTokens(tokens, {
    title: "Low Stock Alert",
    body: `${itemName}: only ${remaining} ${unit} remaining`,
    data: { type: "low_stock", tenantId },
  });
}

export async function notifyPaymentFollowUp(
  tenantId: string,
  clientName: string,
  balanceDue: number,
  invoiceId: string,
): Promise<void> {
  // Notify owner + billing sub-admins
  const ownerRows = await db("users")
    .where({ tenant_id: tenantId, status: "active", role: "owner" })
    .whereNotNull("fcm_token")
    .pluck("fcm_token") as string[];

  const billingSubAdminIds = await db("role_permissions")
    .where({ tenant_id: tenantId, permission: "billing.view" })
    .pluck("user_id") as string[];

  const billingTokens = billingSubAdminIds.length > 0
    ? await tokensForUsers(billingSubAdminIds)
    : [];

  const tokens = [...new Set([...ownerRows, ...billingTokens])];
  await sendToTokens(tokens, {
    title: "Payment Follow-Up",
    body: `${clientName} owes ₹${balanceDue.toLocaleString("en-IN")}`,
    data: { type: "payment_followup", invoiceId, tenantId },
  });
}

export async function notifyDeliveryDueToday(
  tenantId: string,
  jobNumber: number,
  jobTitle: string,
  jobId: string,
): Promise<void> {
  const tokens = await tenantStaffTokens(tenantId);
  await sendToTokens(tokens, {
    title: `Delivery Due Today — Job #${jobNumber}`,
    body: jobTitle,
    data: { type: "delivery_due", jobId, tenantId },
  });
}

export async function notifyJobStatusChanged(
  tenantId: string,
  operatorId: string | null,
  jobNumber: number,
  jobTitle: string,
  newStatus: string,
  jobId: string,
): Promise<void> {
  const ownerTokens = await db("users")
    .where({ tenant_id: tenantId, role: "owner", status: "active" })
    .whereNotNull("fcm_token")
    .pluck("fcm_token") as string[];

  const extra = operatorId ? await tokensForUsers([operatorId]) : [];
  const tokens = [...new Set([...ownerTokens, ...extra])];

  await sendToTokens(tokens, {
    title: `Job #${jobNumber} → ${newStatus}`,
    body: jobTitle,
    data: { type: "job_status", jobId, newStatus, tenantId },
  });
}
