import { Router } from "express";
import { z } from "zod";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";
import { writeAuditLog } from "../middleware/auditLog.js";
import { nextNumber } from "../lib/jobCounter.js";
import { notifyPaymentFollowUp } from "../lib/notifications.js";
import { parseListParams, paginate, applySearch } from "../lib/queryBuilder.js";

const router = Router();
router.use(requireTenant);

const INV_SORT_COLS  = ["invoice_number", "total", "balance_due", "status", "issue_date", "due_date", "created_at"];
const PAY_SORT_COLS  = ["amount", "payment_date", "payment_mode", "created_at"];

const LineItemSchema = z.object({ description: z.string(), qty: z.number(), rate: z.number(), amount: z.number() });

const InvoiceSchema = z.object({
  clientId: z.string().uuid(), jobId: z.string().uuid().optional(),
  quotationId: z.string().uuid().optional(),
  invoiceType: z.enum(["job_work", "goods"]).default("job_work"),
  lineItems: z.array(LineItemSchema).min(1),
  discountAmount: z.number().min(0).default(0),
  gstPercent: z.number().min(0).max(30).default(18),
  advanceAdjusted: z.number().min(0).default(0),
  issueDate: z.string().optional(), dueDate: z.string().optional(), notes: z.string().optional(),
});

function calcInvoiceTotals(lineItems: z.infer<typeof LineItemSchema>[], discount: number, gstPct: number) {
  const subTotal = lineItems.reduce((s, i) => s + i.amount, 0) - discount;
  const gstAmount = (subTotal * gstPct) / 100;
  return { subTotal, gstAmount, total: subTotal + gstAmount };
}

// GET /billing/invoices?page&limit&search&sortBy&sortDir&clientId&status&invoiceType&dueDateFrom&dueDateTo&overdue
router.get("/invoices", requirePermission("billing.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "created_at" });
  const tenantId = req.user.tenantId!;
  const { clientId, status, invoiceType, dueDateFrom, dueDateTo, overdue } = req.query as Record<string, string>;

  let base = db("invoices")
    .where({ "invoices.tenant_id": tenantId })
    .leftJoin("clients", "invoices.client_id", "clients.id")
    .select("invoices.*", "clients.name as client_name", "clients.phone as client_phone");

  let countQ = db("invoices")
    .where({ "invoices.tenant_id": tenantId })
    .leftJoin("clients", "invoices.client_id", "clients.id");

  if (clientId)    { base = base.where({ "invoices.client_id": clientId });     countQ = countQ.where({ "invoices.client_id": clientId }); }
  if (status)      { base = base.where({ "invoices.status": status });           countQ = countQ.where({ "invoices.status": status }); }
  if (invoiceType) { base = base.where({ "invoices.invoice_type": invoiceType }); countQ = countQ.where({ "invoices.invoice_type": invoiceType }); }
  if (dueDateFrom) { base = base.where("invoices.due_date", ">=", dueDateFrom); countQ = countQ.where("invoices.due_date", ">=", dueDateFrom); }
  if (dueDateTo)   { base = base.where("invoices.due_date", "<=", dueDateTo);   countQ = countQ.where("invoices.due_date", "<=", dueDateTo); }
  if (overdue === "1") {
    const today = new Date().toISOString().slice(0, 10);
    base = base.whereIn("invoices.status", ["issued", "partially_paid"]).where("invoices.due_date", "<", today);
    countQ = countQ.whereIn("invoices.status", ["issued", "partially_paid"]).where("invoices.due_date", "<", today);
  }

  base = applySearch(base, params.search, ["clients.name", "clients.phone"]);
  countQ = applySearch(countQ, params.search, ["clients.name", "clients.phone"]);

  res.json(await paginate(base, countQ, params, INV_SORT_COLS, "invoices"));
});

router.get("/invoices/:id", requirePermission("billing.view"), async (req, res) => {
  const inv = await db("invoices")
    .where({ "invoices.id": req.params.id, "invoices.tenant_id": req.user.tenantId! })
    .leftJoin("clients", "invoices.client_id", "clients.id")
    .select("invoices.*", "clients.name as client_name").first();
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  const payments = await db("payments").where({ invoice_id: inv.id }).orderBy("payment_date");
  res.json({ ...inv, payments });
});

router.post("/invoices", requirePermission("billing.create_invoice"), async (req, res) => {
  const parsed = InvoiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const tenantId = req.user.tenantId!;
  const { subTotal, gstAmount, total } = calcInvoiceTotals(d.lineItems, d.discountAmount, d.gstPercent);
  const balanceDue = total - d.advanceAdjusted;

  const invoice = await db.transaction(async (trx) => {
    const invoiceNumber = await nextNumber(trx, tenantId, "last_invoice_number");
    const [inserted] = await trx("invoices").insert({
      tenant_id: tenantId, invoice_number: invoiceNumber, client_id: d.clientId,
      job_id: d.jobId ?? null, quotation_id: d.quotationId ?? null, created_by: req.user.id,
      invoice_type: d.invoiceType, line_items: JSON.stringify(d.lineItems),
      sub_total: subTotal, discount_amount: d.discountAmount, gst_percent: d.gstPercent,
      gst_amount: gstAmount, total, amount_paid: 0, advance_adjusted: d.advanceAdjusted,
      balance_due: balanceDue,
      issue_date: d.issueDate ?? new Date().toISOString().slice(0, 10),
      due_date: d.dueDate ?? null, notes: d.notes ?? null, status: "issued",
    }).returning("*");
    return inserted;
  });

  await writeAuditLog(req, "invoice.created", "invoice", invoice.id, null, invoice);
  res.status(201).json(invoice);
});

router.patch("/invoices/:id/status", requirePermission("billing.create_invoice"), async (req, res) => {
  const { status } = req.body;
  const [updated] = await db("invoices")
    .where({ id: req.params.id, tenant_id: req.user.tenantId! })
    .update({ status, updated_at: new Date() }).returning("*");
  if (!updated) { res.status(404).json({ error: "Invoice not found" }); return; }
  await writeAuditLog(req, "invoice.status_changed", "invoice", req.params.id, null, { status });
  res.json(updated);
});

// GET /billing/payments?page&limit&search&sortBy&sortDir&clientId&paymentMode&type&dateFrom&dateTo
const PaymentSchema = z.object({
  clientId: z.string().uuid(), invoiceId: z.string().uuid().optional(),
  amount: z.number().positive(),
  paymentMode: z.enum(["cash", "upi", "cheque", "neft", "rtgs", "other"]),
  type: z.enum(["advance", "against_invoice", "adjustment"]).default("against_invoice"),
  referenceNumber: z.string().optional(),
  paymentDate: z.string().optional(), notes: z.string().optional(),
});

router.get("/payments", requirePermission("billing.view"), async (req, res) => {
  const params = parseListParams(req, { sortBy: "payment_date" });
  const tenantId = req.user.tenantId!;
  const { clientId, paymentMode, type, dateFrom, dateTo } = req.query as Record<string, string>;

  let base = db("payments")
    .where({ "payments.tenant_id": tenantId })
    .leftJoin("clients", "payments.client_id", "clients.id")
    .select("payments.*", "clients.name as client_name");

  let countQ = db("payments")
    .where({ "payments.tenant_id": tenantId })
    .leftJoin("clients", "payments.client_id", "clients.id");

  if (clientId)    { base = base.where({ "payments.client_id": clientId });        countQ = countQ.where({ "payments.client_id": clientId }); }
  if (paymentMode) { base = base.where({ "payments.payment_mode": paymentMode });  countQ = countQ.where({ "payments.payment_mode": paymentMode }); }
  if (type)        { base = base.where({ "payments.type": type });                 countQ = countQ.where({ "payments.type": type }); }
  if (dateFrom)    { base = base.where("payments.payment_date", ">=", dateFrom);   countQ = countQ.where("payments.payment_date", ">=", dateFrom); }
  if (dateTo)      { base = base.where("payments.payment_date", "<=", dateTo);     countQ = countQ.where("payments.payment_date", "<=", dateTo); }

  base = applySearch(base, params.search, ["clients.name", "payments.reference_number", "payments.notes"]);
  countQ = applySearch(countQ, params.search, ["clients.name", "payments.reference_number", "payments.notes"]);

  res.json(await paginate(base, countQ, params, PAY_SORT_COLS, "payments"));
});

router.post("/payments", requirePermission("billing.record_payment"), async (req, res) => {
  const parsed = PaymentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const tenantId = req.user.tenantId!;

  const payment = await db.transaction(async (trx) => {
    const [inserted] = await trx("payments").insert({
      tenant_id: tenantId, client_id: d.clientId, invoice_id: d.invoiceId ?? null,
      recorded_by: req.user.id, amount: d.amount, payment_mode: d.paymentMode, type: d.type,
      reference_number: d.referenceNumber ?? null,
      payment_date: d.paymentDate ?? new Date().toISOString().slice(0, 10),
      notes: d.notes ?? null,
    }).returning("*");

    if (d.invoiceId) {
      const inv = await trx("invoices").where({ id: d.invoiceId }).first();
      if (inv) {
        const newAmountPaid = Number(inv.amount_paid) + d.amount;
        const newBalance = Math.max(0, Number(inv.balance_due) - d.amount);
        await trx("invoices").where({ id: d.invoiceId }).update({
          amount_paid: newAmountPaid, balance_due: newBalance,
          status: newBalance === 0 ? "paid" : "partially_paid", updated_at: new Date(),
        });
      }
    }
    return inserted;
  });

  await writeAuditLog(req, "payment.recorded", "payment", payment.id, null, payment);
  res.status(201).json(payment);
});

router.get("/ledger/:clientId", requirePermission("billing.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const client = await db("clients").where({ id: req.params.clientId, tenant_id: tenantId }).first();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const invoices = await db("invoices").where({ client_id: req.params.clientId, tenant_id: tenantId }).orderBy("issue_date");
  const payments = await db("payments").where({ client_id: req.params.clientId, tenant_id: tenantId }).orderBy("payment_date");

  const totalBilled = invoices.reduce((s: number, i: { total: string }) => s + Number(i.total), 0);
  const totalPaid = payments.reduce((s: number, p: { amount: string }) => s + Number(p.amount), 0);
  res.json({ client, invoices, payments, summary: { totalBilled, totalPaid, outstanding: totalBilled - totalPaid } });
});

router.post("/payment-reminders", requirePermission("billing.view"), async (req, res) => {
  const tenantId = req.user.tenantId!;
  const overdue = await db("invoices")
    .whereIn("status", ["issued", "partially_paid"])
    .where("due_date", "<", new Date().toISOString().slice(0, 10))
    .where({ tenant_id: tenantId })
    .leftJoin("clients", "invoices.client_id", "clients.id")
    .select("invoices.id", "invoices.balance_due", "clients.name as client_name");

  for (const inv of overdue) await notifyPaymentFollowUp(tenantId, inv.client_name, inv.balance_due, inv.id);
  res.json({ reminded: overdue.length });
});

export default router;
