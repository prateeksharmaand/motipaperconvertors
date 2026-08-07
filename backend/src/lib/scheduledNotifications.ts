import db from "../db/knex.js";
import { notifyDeliveryDueToday, notifyPaymentFollowUp, notifyLowStock } from "./notifications.js";

// Called once on server startup — sets up daily cron-style jobs using setInterval.
// For production, replace with a proper job queue (BullMQ + Redis).
export function startScheduledNotifications(): void {
  // Run at startup then every 24 hours
  runDailyChecks();
  setInterval(runDailyChecks, 24 * 60 * 60 * 1000);
}

async function runDailyChecks(): Promise<void> {
  await Promise.allSettled([
    checkDeliveriesDueToday(),
    checkOverdueInvoices(),
    checkLowStock(),
  ]);
}

async function checkDeliveriesDueToday(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const jobs = await db("job_cards")
    .whereIn("status", ["ready", "qc"])
    .where("due_date", today)
    .select("id", "tenant_id", "job_number", "title");

  for (const job of jobs) {
    await notifyDeliveryDueToday(job.tenant_id, job.job_number, job.title, job.id);
  }
}

async function checkOverdueInvoices(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const invoices = await db("invoices")
    .whereIn("status", ["issued", "partially_paid"])
    .where("due_date", "<", today)
    .leftJoin("clients", "invoices.client_id", "clients.id")
    .select(
      "invoices.id",
      "invoices.tenant_id",
      "invoices.balance_due",
      "clients.name as client_name",
    );

  for (const inv of invoices) {
    await notifyPaymentFollowUp(inv.tenant_id, inv.client_name, inv.balance_due, inv.id);
  }
}

async function checkLowStock(): Promise<void> {
  // Paper stock
  const lowPaper = await db("paper_stock")
    .whereRaw("quantity <= low_stock_threshold")
    .select("tenant_id", "name", "quantity", "unit");

  for (const item of lowPaper) {
    await notifyLowStock(item.tenant_id, item.name, item.quantity, item.unit);
  }

  // Other inventory
  const lowItems = await db("inventory_items")
    .whereRaw("quantity <= low_stock_threshold")
    .select("tenant_id", "name", "quantity", "unit");

  for (const item of lowItems) {
    await notifyLowStock(item.tenant_id, item.name, item.quantity, item.unit);
  }
}
