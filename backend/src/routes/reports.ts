import { Router } from "express";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";

const router = Router();
router.use(requireTenant);

// ── GET /reports/job-profitability ────────────────────────
// Estimated vs actual cost per job. Requires reports.view_financial.
router.get("/job-profitability", requirePermission("reports.view_financial"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const { from, to, limit = "50" } = req.query as Record<string, string>;

  let query = db("job_cards")
    .where({ "job_cards.tenant_id": tenantId })
    .leftJoin("clients", "job_cards.client_id", "clients.id")
    .select(
      "job_cards.id",
      "job_cards.job_number",
      "job_cards.title",
      "job_cards.status",
      "job_cards.estimated_cost",
      "job_cards.actual_cost",
      "job_cards.quoted_price",
      "job_cards.due_date",
      "job_cards.completed_at",
      "clients.name as client_name",
      db.raw(`
        CASE
          WHEN job_cards.quoted_price IS NOT NULL AND job_cards.actual_cost IS NOT NULL
          THEN job_cards.quoted_price - job_cards.actual_cost
          ELSE NULL
        END as actual_margin
      `),
      db.raw(`
        CASE
          WHEN job_cards.quoted_price IS NOT NULL AND job_cards.actual_cost > 0
          THEN ROUND(((job_cards.quoted_price - job_cards.actual_cost) / job_cards.actual_cost) * 100, 2)
          ELSE NULL
        END as margin_percent
      `),
    )
    .whereNotNull("job_cards.quoted_price")
    .orderBy("job_cards.created_at", "desc")
    .limit(parseInt(limit));

  if (from) query = query.where("job_cards.created_at", ">=", from);
  if (to) query = query.where("job_cards.created_at", "<=", to);

  const jobs = await query;

  // Summary row
  const totals = jobs.reduce((acc: { revenue: number; cost: number; margin: number }, j: Record<string, number>) => ({
    revenue: acc.revenue + Number(j.quoted_price ?? 0),
    cost: acc.cost + Number(j.actual_cost ?? 0),
    margin: acc.margin + Number(j.actual_margin ?? 0),
  }), { revenue: 0, cost: 0, margin: 0 });

  res.json({ jobs, summary: totals });
});

// ── GET /reports/machine-utilization ─────────────────────
router.get("/machine-utilization", requirePermission("production.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const { from, to } = req.query as Record<string, string>;

  let query = db("job_cards")
    .where({ "job_cards.tenant_id": tenantId })
    .whereNotNull("job_cards.machine_id")
    .leftJoin("machines", "job_cards.machine_id", "machines.id")
    .groupBy("machines.id", "machines.name")
    .select(
      "machines.id as machine_id",
      "machines.name as machine_name",
      "machines.status as machine_status",
      db.raw("COUNT(job_cards.id) as total_jobs"),
      db.raw("COUNT(CASE WHEN job_cards.status = 'delivered' THEN 1 END) as completed_jobs"),
      db.raw("COUNT(CASE WHEN job_cards.status NOT IN ('delivered','cancelled') THEN 1 END) as active_jobs"),
    );

  if (from) query = query.where("job_cards.created_at", ">=", from);
  if (to) query = query.where("job_cards.created_at", "<=", to);

  res.json(await query);
});

// ── GET /reports/outstanding-payments ────────────────────
router.get("/outstanding-payments", requirePermission("billing.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const invoices = await db("invoices")
    .where({ tenant_id: tenantId })
    .whereIn("status", ["issued", "partially_paid"])
    .leftJoin("clients", "invoices.client_id", "clients.id")
    .select(
      "invoices.id",
      "invoices.invoice_number",
      "invoices.total",
      "invoices.amount_paid",
      "invoices.balance_due",
      "invoices.due_date",
      "invoices.issue_date",
      "clients.name as client_name",
      "clients.phone as client_phone",
      db.raw(`
        CASE
          WHEN invoices.due_date < CURRENT_DATE THEN 'overdue'
          WHEN invoices.due_date = CURRENT_DATE THEN 'due_today'
          ELSE 'upcoming'
        END as urgency
      `),
    )
    .orderBy("invoices.due_date");

  const total = invoices.reduce((s: number, i: { balance_due: string }) => s + Number(i.balance_due), 0);
  res.json({ invoices, summary: { total_outstanding: total, count: invoices.length } });
});

// ── GET /reports/staff-output ─────────────────────────────
router.get("/staff-output", requirePermission("production.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const { from, to } = req.query as Record<string, string>;

  let query = db("job_cards")
    .where({ "job_cards.tenant_id": tenantId })
    .whereNotNull("job_cards.assigned_operator_id")
    .leftJoin("users", "job_cards.assigned_operator_id", "users.id")
    .groupBy("users.id", "users.name")
    .select(
      "users.id as operator_id",
      "users.name as operator_name",
      db.raw("COUNT(job_cards.id) as total_jobs"),
      db.raw("COUNT(CASE WHEN job_cards.status = 'delivered' THEN 1 END) as completed_jobs"),
    );

  if (from) query = query.where("job_cards.created_at", ">=", from);
  if (to) query = query.where("job_cards.created_at", "<=", to);

  res.json(await query);
});

// ── GET /reports/summary — dashboard numbers ──────────────
router.get("/summary", requirePermission("jobs.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;

  const [jobStats] = await db("job_cards").where({ tenant_id: tenantId }).select(
    db.raw("COUNT(*) as total_jobs"),
    db.raw("COUNT(CASE WHEN status NOT IN ('delivered','cancelled') THEN 1 END) as active_jobs"),
    db.raw("COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_jobs"),
    db.raw("COUNT(CASE WHEN due_date = CURRENT_DATE THEN 1 END) as due_today"),
  );

  const [billingStats] = await db("invoices").where({ tenant_id: tenantId }).select(
    db.raw("COALESCE(SUM(total),0) as total_billed"),
    db.raw("COALESCE(SUM(balance_due),0) as total_outstanding"),
  );

  const [stockAlerts] = await db("paper_stock")
    .where({ tenant_id: tenantId })
    .whereRaw("quantity <= low_stock_threshold")
    .count("id as count");

  res.json({
    jobs: jobStats,
    billing: billingStats,
    low_stock_alerts: Number(stockAlerts.count),
  });
});

export default router;
