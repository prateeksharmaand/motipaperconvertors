import { Router } from "express";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";
import { exportToCsvBuffer } from "../lib/exportCsv.js";

const router = Router();
router.use(requireTenant);

const SORT_COLS = new Set(["created_at", "user_name", "module", "action", "category", "entity_type", "status"]);

// ── GET /activity-logs ────────────────────────────────────
router.get("/", requirePermission("activity_log.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const {
    page = "1", limit = "50", search = "",
    sortBy = "created_at", sortDir = "desc",
    userId, module: mod, category, action, entityType, entityId,
    source, status, fromDate, toDate,
  } = req.query as Record<string, string>;

  const pageNum  = Math.max(1, parseInt(page));
  const limitNum = Math.min(250, Math.max(1, parseInt(limit)));
  const col      = SORT_COLS.has(sortBy) ? sortBy : "created_at";
  const dir      = sortDir === "asc" ? "asc" : "desc";

  function applyFilters(q: ReturnType<typeof db>) {
    q = q.where("activity_logs.tenant_id", tenantId);
    if (userId)     q = q.where("activity_logs.user_id", userId);
    if (mod)        q = q.whereILike("activity_logs.module", `%${mod}%`);
    if (category)   q = q.where("activity_logs.category", category);
    if (action)     q = q.where("activity_logs.action", action);
    if (entityType) q = q.where("activity_logs.entity_type", entityType);
    if (entityId)   q = q.where("activity_logs.entity_id", entityId);
    if (source)     q = q.where("activity_logs.source", source);
    if (status)     q = q.where("activity_logs.status", status);
    if (fromDate)   q = q.where("activity_logs.created_at", ">=", fromDate);
    if (toDate)     q = q.where("activity_logs.created_at", "<=", toDate + "T23:59:59Z");
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.where(function() {
        this.whereILike("activity_logs.user_name", s)
            .orWhereILike("activity_logs.user_email", s)
            .orWhereILike("activity_logs.description", s)
            .orWhereILike("activity_logs.entity_id", s)
            .orWhereILike("activity_logs.entity_name", s)
            .orWhereILike("activity_logs.action", s)
            .orWhereILike("activity_logs.module", s)
            .orWhereILike("activity_logs.ip_address", s)
            .orWhereILike("activity_logs.request_id", s);
      });
    }
    return q;
  }

  const [{ count }] = await applyFilters(db("activity_logs")).count("id as count") as { count: string }[];
  const total = Number(count);

  const data = await applyFilters(db("activity_logs"))
    .select(
      "id", "user_id", "user_name", "user_email", "user_role",
      "category", "action", "module", "feature", "operation", "description",
      "entity_type", "entity_id", "entity_name",
      "changed_fields", "source", "ip_address", "status", "created_at",
      // Omit large JSON from list — fetched on expand
    )
    .orderBy(col, dir)
    .offset((pageNum - 1) * limitNum)
    .limit(limitNum);

  res.json({
    data,
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
  });
});

// ── GET /activity-logs/summary ────────────────────────────
router.get("/summary", requirePermission("activity_log.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);

  const [total]       = await db("activity_logs").where({ tenant_id: tenantId }).count("id as n");
  const [today]       = await db("activity_logs").where({ tenant_id: tenantId }).where("created_at", ">=", todayStart).count("id as n");
  const [failed]      = await db("activity_logs").where({ tenant_id: tenantId }).where("status", "FAILED").count("id as n");
  const [security]    = await db("activity_logs").where({ tenant_id: tenantId }).where("category", "SECURITY").count("id as n");
  const uniqueUsers   = await db("activity_logs").where({ tenant_id: tenantId }).whereNotNull("user_id").countDistinct("user_id as n");

  // Activity by day (last 7 days)
  const byDay = await db("activity_logs")
    .where({ tenant_id: tenantId })
    .where("created_at", ">=", db.raw("CURRENT_DATE - INTERVAL '7 days'"))
    .groupByRaw("DATE(created_at)")
    .select(db.raw("DATE(created_at) as date"), db.raw("COUNT(*) as count"))
    .orderBy("date");

  // Activity by module
  const byModule = await db("activity_logs")
    .where({ tenant_id: tenantId })
    .whereNotNull("module")
    .groupBy("module")
    .select("module", db.raw("COUNT(*) as count"))
    .orderByRaw("COUNT(*) DESC")
    .limit(8);

  res.json({
    total:       Number(total.n),
    today:       Number(today.n),
    failed:      Number(failed.n),
    security:    Number(security.n),
    uniqueUsers: Number(uniqueUsers[0].n),
    byDay,
    byModule,
  });
});

// ── GET /activity-logs/filters-meta ───────────────────────
// Returns distinct values for filter dropdowns
router.get("/filters-meta", requirePermission("activity_log.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const [modules, categories, actions, sources] = await Promise.all([
    db("activity_logs").where({ tenant_id: tenantId }).whereNotNull("module").distinct("module").orderBy("module").pluck("module"),
    db("activity_logs").where({ tenant_id: tenantId }).distinct("category").orderBy("category").pluck("category"),
    db("activity_logs").where({ tenant_id: tenantId }).distinct("action").orderBy("action").pluck("action"),
    db("activity_logs").where({ tenant_id: tenantId }).whereNotNull("source").distinct("source").orderBy("source").pluck("source"),
  ]);
  res.json({ modules, categories, actions, sources });
});

// ── GET /activity-logs/:id ────────────────────────────────
router.get("/:id", requirePermission("activity_log.view"), async (req, res) => {
  const row = await db("activity_logs")
    .where({ id: req.params.id, tenant_id: req.user.tenantId! })
    .first();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// ── GET /activity-logs/entity/:type/:id ──────────────────
router.get("/entity/:entityType/:entityId", requirePermission("activity_log.view"), async (req, res) => {
  const { entityType, entityId } = req.params;
  const rows = await db("activity_logs")
    .where({ tenant_id: req.user.tenantId!, entity_type: entityType, entity_id: entityId })
    .orderBy("created_at", "asc")
    .select("id", "user_name", "user_role", "action", "category", "description", "changed_fields", "before", "after", "status", "created_at");
  res.json(rows);
});

// ── GET /activity-logs/user/:userId ──────────────────────
router.get("/user/:userId", requirePermission("activity_log.view"), async (req, res) => {
  const { page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));

  const [{ count }] = await db("activity_logs")
    .where({ tenant_id: req.user.tenantId!, user_id: req.params.userId }).count("id as count");

  const data = await db("activity_logs")
    .where({ tenant_id: req.user.tenantId!, user_id: req.params.userId })
    .orderBy("created_at", "desc")
    .select("id", "action", "module", "description", "entity_type", "entity_id", "entity_name", "status", "created_at")
    .offset((pageNum - 1) * limitNum).limit(limitNum);

  res.json({ data, total: Number(count), page: pageNum, totalPages: Math.ceil(Number(count) / limitNum) });
});

// ── GET /activity-logs/export ─────────────────────────────
router.get("/export/csv", requirePermission("activity_log.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const { userId, module: mod, category, action, source, status, fromDate, toDate, search } = req.query as Record<string, string>;

  let q = db("activity_logs").where({ tenant_id: tenantId });
  if (userId)   q = q.where("user_id", userId);
  if (mod)      q = q.whereILike("module", `%${mod}%`);
  if (category) q = q.where("category", category);
  if (action)   q = q.where("action", action);
  if (source)   q = q.where("source", source);
  if (status)   q = q.where("status", status);
  if (fromDate) q = q.where("created_at", ">=", fromDate);
  if (toDate)   q = q.where("created_at", "<=", toDate + "T23:59:59Z");
  if (search?.trim()) {
    const s = `%${search.trim()}%`;
    q = q.where(qb => qb.whereILike("user_name", s).orWhereILike("description", s).orWhereILike("entity_id", s));
  }

  const rows = await q.orderBy("created_at", "desc").limit(10000)
    .select("created_at", "user_name", "user_email", "user_role", "category", "action", "module", "description", "entity_type", "entity_id", "entity_name", "status", "ip_address", "source");

  const csv = rows.map((r: Record<string, unknown>) => ({
    "Date/Time": r.created_at,
    "User": r.user_name,
    "Email": r.user_email,
    "Role": r.user_role,
    "Category": r.category,
    "Action": r.action,
    "Module": r.module,
    "Description": r.description,
    "Entity Type": r.entity_type,
    "Entity ID": r.entity_id,
    "Entity Name": r.entity_name,
    "Status": r.status,
    "IP Address": r.ip_address,
    "Source": r.source,
  }));

  const buf = exportToCsvBuffer(csv);
  const filename = `activity-logs-${new Date().toISOString().slice(0,10)}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buf);
});

export default router;
