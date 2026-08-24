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
        COALESCE(job_cards.plate_cost,0) + COALESCE(job_cards.die_cost,0) +
        COALESCE(job_cards.composing_amount,0) + COALESCE(job_cards.hela_cost,0) +
        COALESCE(job_cards.other_cost,0) + COALESCE(job_cards.approved_rate,0) as computed_cost
      `),
      db.raw(`
        CASE
          WHEN job_cards.quoted_price IS NOT NULL AND (
            COALESCE(job_cards.plate_cost,0) + COALESCE(job_cards.die_cost,0) +
            COALESCE(job_cards.composing_amount,0) + COALESCE(job_cards.hela_cost,0) +
            COALESCE(job_cards.other_cost,0) + COALESCE(job_cards.approved_rate,0)
          ) > 0
          THEN job_cards.quoted_price - (
            COALESCE(job_cards.plate_cost,0) + COALESCE(job_cards.die_cost,0) +
            COALESCE(job_cards.composing_amount,0) + COALESCE(job_cards.hela_cost,0) +
            COALESCE(job_cards.other_cost,0) + COALESCE(job_cards.approved_rate,0)
          )
          ELSE NULL
        END as actual_margin
      `),
      db.raw(`
        CASE
          WHEN job_cards.quoted_price IS NOT NULL AND (
            COALESCE(job_cards.plate_cost,0) + COALESCE(job_cards.die_cost,0) +
            COALESCE(job_cards.composing_amount,0) + COALESCE(job_cards.hela_cost,0) +
            COALESCE(job_cards.other_cost,0) + COALESCE(job_cards.approved_rate,0)
          ) > 0
          THEN ROUND(
            (job_cards.quoted_price - (
              COALESCE(job_cards.plate_cost,0) + COALESCE(job_cards.die_cost,0) +
              COALESCE(job_cards.composing_amount,0) + COALESCE(job_cards.hela_cost,0) +
              COALESCE(job_cards.other_cost,0) + COALESCE(job_cards.approved_rate,0)
            )) / NULLIF((
              COALESCE(job_cards.plate_cost,0) + COALESCE(job_cards.die_cost,0) +
              COALESCE(job_cards.composing_amount,0) + COALESCE(job_cards.hela_cost,0) +
              COALESCE(job_cards.other_cost,0) + COALESCE(job_cards.approved_rate,0)
            ), 0) * 100, 2)
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
    cost: acc.cost + Number(j.computed_cost ?? 0),
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
router.get("/outstanding-payments", requirePermission("reports.view_financial"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const invoices = await db("invoices")
    .where({ "invoices.tenant_id": tenantId })
    .whereIn("invoices.status", ["issued", "partially_paid"])
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

// ── GET /reports/revenue-by-client ───────────────────────
router.get("/revenue-by-client", requirePermission("reports.view_financial"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const { from, to } = req.query as Record<string, string>;

  let query = db("invoices")
    .where({ "invoices.tenant_id": tenantId })
    .leftJoin("clients", "invoices.client_id", "clients.id")
    .groupBy("clients.id", "clients.name")
    .select(
      "clients.id as client_id",
      "clients.name as client_name",
      db.raw("COUNT(invoices.id) as total_invoices"),
      db.raw("COALESCE(SUM(invoices.total), 0) as total_billed"),
      db.raw("COALESCE(SUM(invoices.amount_paid), 0) as total_paid"),
      db.raw("COALESCE(SUM(invoices.balance_due), 0) as total_outstanding"),
    )
    .orderByRaw("SUM(invoices.total) DESC")
    .limit(20);

  if (from) query = query.where("invoices.issue_date", ">=", from);
  if (to)   query = query.where("invoices.issue_date", "<=", to);

  res.json(await query);
});

// ── GET /reports/jobs-by-status ───────────────────────────
router.get("/jobs-by-status", requirePermission("jobs.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const { from, to } = req.query as Record<string, string>;

  let query = db("job_cards")
    .where({ tenant_id: tenantId })
    .groupBy("status")
    .select(
      "status",
      db.raw("COUNT(*) as count"),
      db.raw("COALESCE(SUM(quoted_price), 0) as total_value"),
    )
    .orderBy("count", "desc");

  if (from) query = query.where("created_at", ">=", from);
  if (to)   query = query.where("created_at", "<=", to);

  res.json(await query);
});

// ── GET /reports/paper-consumption ───────────────────────
router.get("/paper-consumption", requirePermission("inventory.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const { from, to } = req.query as Record<string, string>;

  let query = db("inventory_transactions")
    .where({ "inventory_transactions.tenant_id": tenantId, "inventory_transactions.type": "out" })
    .whereNotNull("inventory_transactions.paper_stock_id")
    .leftJoin("paper_stock", "inventory_transactions.paper_stock_id", "paper_stock.id")
    .groupBy("paper_stock.id", "paper_stock.name", "paper_stock.gsm", "paper_stock.size", "paper_stock.unit")
    .select(
      "paper_stock.id as paper_stock_id",
      "paper_stock.name as paper_name",
      "paper_stock.gsm",
      "paper_stock.size",
      "paper_stock.unit",
      db.raw("COUNT(inventory_transactions.id) as usage_count"),
      db.raw("COALESCE(SUM(inventory_transactions.quantity), 0) as total_sheets"),
    )
    .orderByRaw("SUM(inventory_transactions.quantity) DESC");

  if (from) query = query.where("inventory_transactions.transacted_at", ">=", from);
  if (to)   query = query.where("inventory_transactions.transacted_at", "<=", to);

  res.json(await query);
});

// ── GET /reports/monthly-revenue ─────────────────────────
router.get("/monthly-revenue", requirePermission("reports.view_financial"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const { months = "12", from, to } = req.query as Record<string, string>;

  let query = db("invoices")
    .where({ tenant_id: tenantId })
    .groupByRaw("TO_CHAR(issue_date, 'YYYY-MM')")
    .select(
      db.raw("TO_CHAR(issue_date, 'YYYY-MM') as month"),
      db.raw("COALESCE(SUM(total), 0) as revenue"),
      db.raw("COALESCE(SUM(amount_paid), 0) as collected"),
      db.raw("COUNT(*) as invoice_count"),
    )
    .orderBy("month");

  if (from) query = query.where("issue_date", ">=", from);
  else if (to) query = query.where("issue_date", ">=", db.raw(`CURRENT_DATE - INTERVAL '${parseInt(months)} months'`));
  else query = query.where("issue_date", ">=", db.raw(`CURRENT_DATE - INTERVAL '${parseInt(months)} months'`));
  if (to) query = query.where("issue_date", "<=", to);

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

// ── GET /reports/client-jobs ──────────────────────────────
router.get("/client-jobs", requirePermission("jobs.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const { clientId, status, from, to, search, page = "1", limit = "20", sortBy = "created_at", sortDir = "desc" } = req.query as Record<string, string>;

  if (!clientId) { res.status(400).json({ error: "clientId is required" }); return; }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  let base = db("job_cards")
    .where({ "job_cards.tenant_id": tenantId, "job_cards.client_id": clientId })
    .leftJoin("machines", "job_cards.machine_id", "machines.id")
    .select("job_cards.*", "machines.name as machine_name");

  if (status) base = base.where("job_cards.status", status);
  if (from)   base = base.where("job_cards.created_at", ">=", from);
  if (to)     base = base.where("job_cards.created_at", "<=", to);
  if (search) base = base.where(function () {
    this.whereILike("job_cards.title", `%${search}%`)
        .orWhereILike("job_cards.job_type", `%${search}%`);
  });

  const allowedSort = ["created_at", "due_date", "job_number", "status", "quoted_price", "quantity"];
  const sortCol = allowedSort.includes(sortBy) ? `job_cards.${sortBy}` : "job_cards.created_at";
  const dir = sortDir === "asc" ? "asc" : "desc";

  const [{ count }] = await base.clone().clearSelect().count("job_cards.id as count");
  const jobs = await base.clone().orderBy(sortCol, dir).limit(limitNum).offset(offset);

  // Summary stats — respect same date range as table
  let statsBase = db("job_cards").where({ tenant_id: tenantId, client_id: clientId });
  if (from) statsBase = statsBase.where("created_at", ">=", from);
  if (to)   statsBase = statsBase.where("created_at", "<=", to);

  const [stats] = await statsBase.clone().select(
    db.raw("COUNT(*) as total_jobs"),
    db.raw("COUNT(CASE WHEN status NOT IN ('delivered','cancelled') THEN 1 END) as active_jobs"),
    db.raw("COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_jobs"),
    db.raw("COALESCE(SUM(quoted_price), 0) as total_revenue"),
    db.raw("COALESCE(SUM(advance_amount), 0) as total_advance"),
  );

  // Jobs by status breakdown — respect same date range
  const statusBreakdown = await statsBase.clone()
    .groupBy("status")
    .select("status", db.raw("COUNT(*) as count"));

  const total = Number(count);
  res.json({
    data: jobs,
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
    summary: stats,
    statusBreakdown,
  });
});

export default router;
