import { Router } from "express";
import { z } from "zod";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";
import { writeAuditLog } from "../middleware/auditLog.js";
import { notifyLowStock } from "../lib/notifications.js";
import { parseListParams, paginate, applySearch } from "../lib/queryBuilder.js";

const router = Router();
router.use(requireTenant);

const PAPER_SORT_COLS = ["name", "brand", "gsm", "quantity", "created_at"];
const ITEM_SORT_COLS  = ["name", "category", "quantity", "created_at"];
const TXN_SORT_COLS   = ["transacted_at", "type", "quantity"];

// ══════════════════════════════════════════════════════════
//  PAPER STOCK — GET /inventory/paper?search&sortBy&page&limit&type&brand&isLow
// ══════════════════════════════════════════════════════════

const PaperStockSchema = z.object({
  name: z.string().min(1), brand: z.string().optional(), type: z.string().optional(),
  gsm: z.number().int().positive().optional(), size: z.string().optional(),
  widthMm: z.number().int().positive().optional(), heightMm: z.number().int().positive().optional(),
  unit: z.string().default("sheets"), quantity: z.number().min(0).default(0),
  lowStockThreshold: z.number().min(0).default(100), costPerUnit: z.number().min(0).optional(),
});

router.get("/paper", requirePermission("inventory.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "name" });
  const tenantId = req.user.tenantId!;
  const { type, brand, isLow } = req.query as Record<string, string>;

  let base = db("paper_stock").where({ tenant_id: tenantId });
  let countQ = db("paper_stock").where({ tenant_id: tenantId });

  if (type) { base = base.whereILike("type", `%${type}%`); countQ = countQ.whereILike("type", `%${type}%`); }
  if (brand) { base = base.whereILike("brand", `%${brand}%`); countQ = countQ.whereILike("brand", `%${brand}%`); }
  if (isLow === "1") {
    base = base.whereRaw("quantity <= low_stock_threshold");
    countQ = countQ.whereRaw("quantity <= low_stock_threshold");
  }

  base = applySearch(base, params.search, ["name", "brand", "type", "size"]);
  countQ = applySearch(countQ, params.search, ["name", "brand", "type", "size"]);

  const result = await paginate(base, countQ, params, PAPER_SORT_COLS);
  result.data = result.data.map((i: Record<string, unknown>) => ({
    ...i, is_low: Number(i.quantity) <= Number(i.low_stock_threshold),
  }));
  res.json(result);
});

router.post("/paper", requirePermission("inventory.edit"), async (req, res) => {
  const parsed = PaperStockSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const [item] = await db("paper_stock").insert({
    tenant_id: req.user.tenantId!, name: d.name, brand: d.brand ?? null, type: d.type ?? null,
    gsm: d.gsm ?? null, size: d.size ?? null, width_mm: d.widthMm ?? null,
    height_mm: d.heightMm ?? null, unit: d.unit, quantity: d.quantity,
    low_stock_threshold: d.lowStockThreshold, cost_per_unit: d.costPerUnit ?? null,
  }).returning("*");
  res.status(201).json(item);
});

router.patch("/paper/:id", requirePermission("inventory.edit"), async (req, res) => {
  const parsed = PaperStockSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (d.name !== undefined) updates.name = d.name;
  if (d.brand !== undefined) updates.brand = d.brand ?? null;
  if (d.type !== undefined) updates.type = d.type ?? null;
  if (d.gsm !== undefined) updates.gsm = d.gsm ?? null;
  if (d.size !== undefined) updates.size = d.size ?? null;
  if (d.unit !== undefined) updates.unit = d.unit;
  if (d.quantity !== undefined) updates.quantity = d.quantity;
  if (d.lowStockThreshold !== undefined) updates.low_stock_threshold = d.lowStockThreshold;
  if (d.costPerUnit !== undefined) updates.cost_per_unit = d.costPerUnit ?? null;
  const [updated] = await db("paper_stock")
    .where({ id: req.params.id, tenant_id: req.user.tenantId! })
    .update(updates).returning("*");
  if (!updated) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(updated);
});

// ══════════════════════════════════════════════════════════
//  INVENTORY ITEMS — GET /inventory/items?search&category&isLow&page&limit&sortBy
// ══════════════════════════════════════════════════════════

const InventoryItemSchema = z.object({
  name: z.string().min(1), category: z.enum(["ink", "plate", "consumable", "other"]),
  unit: z.string().default("pcs"), quantity: z.number().min(0).default(0),
  lowStockThreshold: z.number().min(0).default(10), costPerUnit: z.number().min(0).optional(),
});

router.get("/items", requirePermission("inventory.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "name" });
  const tenantId = req.user.tenantId!;
  const { category, isLow } = req.query as Record<string, string>;

  let base = db("inventory_items").where({ tenant_id: tenantId });
  let countQ = db("inventory_items").where({ tenant_id: tenantId });

  if (category) { base = base.where({ category }); countQ = countQ.where({ category }); }
  if (isLow === "1") {
    base = base.whereRaw("quantity <= low_stock_threshold");
    countQ = countQ.whereRaw("quantity <= low_stock_threshold");
  }

  base = applySearch(base, params.search, ["name"]);
  countQ = applySearch(countQ, params.search, ["name"]);

  const result = await paginate(base, countQ, params, ITEM_SORT_COLS);
  result.data = result.data.map((i: Record<string, unknown>) => ({
    ...i, is_low: Number(i.quantity) <= Number(i.low_stock_threshold),
  }));
  res.json(result);
});

router.post("/items", requirePermission("inventory.edit"), async (req, res) => {
  const parsed = InventoryItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const [item] = await db("inventory_items").insert({
    tenant_id: req.user.tenantId!, name: d.name, category: d.category,
    unit: d.unit, quantity: d.quantity,
    low_stock_threshold: d.lowStockThreshold, cost_per_unit: d.costPerUnit ?? null,
  }).returning("*");
  res.status(201).json(item);
});

router.patch("/items/:id", requirePermission("inventory.edit"), async (req, res) => {
  const parsed = InventoryItemSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (d.name !== undefined) updates.name = d.name;
  if (d.category !== undefined) updates.category = d.category;
  if (d.unit !== undefined) updates.unit = d.unit;
  if (d.quantity !== undefined) updates.quantity = d.quantity;
  if (d.lowStockThreshold !== undefined) updates.low_stock_threshold = d.lowStockThreshold;
  if (d.costPerUnit !== undefined) updates.cost_per_unit = d.costPerUnit ?? null;
  const [updated] = await db("inventory_items")
    .where({ id: req.params.id, tenant_id: req.user.tenantId! })
    .update(updates).returning("*");
  if (!updated) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(updated);
});

// ══════════════════════════════════════════════════════════
//  TRANSACTIONS — GET /inventory/transactions?type&page&limit&sortBy&paperStockId&inventoryItemId
// ══════════════════════════════════════════════════════════

const TransactionSchema = z.object({
  paperStockId: z.string().uuid().optional(),
  inventoryItemId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  type: z.enum(["in", "out", "adjustment", "wastage"]),
  quantity: z.number(),
  unitCost: z.number().min(0).optional(),
  notes: z.string().optional(),
  poReference: z.string().optional(),
}).refine((d) => d.paperStockId || d.inventoryItemId, {
  message: "Either paperStockId or inventoryItemId is required",
});

router.get("/transactions", requirePermission("inventory.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "transacted_at" });
  const tenantId = req.user.tenantId!;
  const { type, paperStockId, inventoryItemId } = req.query as Record<string, string>;

  let base = db("inventory_transactions")
    .where({ "inventory_transactions.tenant_id": tenantId })
    .leftJoin("users", "inventory_transactions.performed_by", "users.id")
    .leftJoin("paper_stock", "inventory_transactions.paper_stock_id", "paper_stock.id")
    .leftJoin("inventory_items", "inventory_transactions.inventory_item_id", "inventory_items.id")
    .select(
      "inventory_transactions.*",
      "users.name as performed_by_name",
      "paper_stock.name as paper_name",
      "inventory_items.name as item_name",
    );

  let countQ = db("inventory_transactions").where({ "inventory_transactions.tenant_id": tenantId });

  if (type) { base = base.where({ "inventory_transactions.type": type }); countQ = countQ.where({ "inventory_transactions.type": type }); }
  if (paperStockId) { base = base.where({ "inventory_transactions.paper_stock_id": paperStockId }); countQ = countQ.where({ paper_stock_id: paperStockId }); }
  if (inventoryItemId) { base = base.where({ "inventory_transactions.inventory_item_id": inventoryItemId }); countQ = countQ.where({ inventory_item_id: inventoryItemId }); }

  base = applySearch(base, params.search, ["paper_stock.name", "inventory_items.name", "inventory_transactions.notes", "inventory_transactions.po_reference"]);
  countQ = applySearch(countQ, params.search, ["inventory_transactions.notes"]);

  res.json(await paginate(base, countQ, params, TXN_SORT_COLS, "inventory_transactions"));
});

router.post("/transactions", requirePermission("inventory.edit"), async (req, res) => {
  const parsed = TransactionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const tenantId = req.user.tenantId!;

  const [txn] = await db.transaction(async (trx) => {
    const [inserted] = await trx("inventory_transactions").insert({
      tenant_id: tenantId, paper_stock_id: d.paperStockId ?? null,
      inventory_item_id: d.inventoryItemId ?? null, job_id: d.jobId ?? null,
      performed_by: req.user.id, type: d.type, quantity: d.quantity,
      unit_cost: d.unitCost ?? null, notes: d.notes ?? null, po_reference: d.poReference ?? null,
    }).returning("*");

    const delta = (d.type === "in" || d.type === "adjustment") ? d.quantity : -Math.abs(d.quantity);
    if (d.paperStockId) await trx("paper_stock").where({ id: d.paperStockId }).increment("quantity", delta);
    else if (d.inventoryItemId) await trx("inventory_items").where({ id: d.inventoryItemId }).increment("quantity", delta);
    return [inserted];
  });

  if (d.paperStockId) {
    const item = await db("paper_stock").where({ id: d.paperStockId }).first();
    if (item && item.quantity <= item.low_stock_threshold) await notifyLowStock(tenantId, item.name, item.quantity, item.unit);
  } else if (d.inventoryItemId) {
    const item = await db("inventory_items").where({ id: d.inventoryItemId }).first();
    if (item && item.quantity <= item.low_stock_threshold) await notifyLowStock(tenantId, item.name, item.quantity, item.unit);
  }

  await writeAuditLog(req, "inventory.transaction", "inventory_transaction", txn.id, null, txn);
  res.status(201).json(txn);
});

router.get("/summary", requirePermission("inventory.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const [{ count: lowPaper }] = await db("paper_stock").where({ tenant_id: tenantId }).whereRaw("quantity <= low_stock_threshold").count("id as count");
  const [{ count: lowItems }] = await db("inventory_items").where({ tenant_id: tenantId }).whereRaw("quantity <= low_stock_threshold").count("id as count");
  res.json({ low_stock_alerts: Number(lowPaper) + Number(lowItems) });
});

export default router;
