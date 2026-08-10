import db from "../db/knex.js";
import { notifyDeliveryDueToday, notifyPaymentFollowUp, notifyLowStock } from "./notifications.js";
import { sendPaymentReminderEmail } from "./mailer.js";

// Called once on server startup — sets up daily cron-style jobs using setInterval.
export function startScheduledNotifications(): void {
  runDailyChecks();
  setInterval(runDailyChecks, 24 * 60 * 60 * 1000);
  scheduleAt9AM();
}

// Schedule auto email reminders at 9 AM daily
function scheduleAt9AM(): void {
  const now = new Date();
  const next9AM = new Date(now);
  next9AM.setHours(9, 0, 0, 0);
  if (next9AM <= now) next9AM.setDate(next9AM.getDate() + 1);
  const msUntil9AM = next9AM.getTime() - now.getTime();
  setTimeout(() => {
    sendAutoEmailReminders();
    setInterval(sendAutoEmailReminders, 24 * 60 * 60 * 1000);
  }, msUntil9AM);
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

// Send auto email reminders to clients with email_reminder=true who have unpaid invoices
async function sendAutoEmailReminders(): Promise<void> {
  try {
    const unpaid = await db("invoices")
      .whereIn("invoices.status", ["issued", "partially_paid"])
      .leftJoin("clients", "invoices.client_id", "clients.id")
      .leftJoin("tenants", "invoices.tenant_id", "tenants.id")
      .where("clients.email_reminder", true)
      .whereNotNull("clients.email")
      .select(
        "invoices.id", "invoices.invoice_number", "invoices.total",
        "invoices.amount_paid", "invoices.balance_due", "invoices.due_date",
        "clients.name as client_name", "clients.email as client_email",
        "tenants.name as press_name",
      );
    for (const inv of unpaid) {
      try {
        await sendPaymentReminderEmail({
          to: inv.client_email,
          clientName: inv.client_name,
          pressName: inv.press_name,
          invoiceNumber: inv.invoice_number,
          total: inv.total,
          amountPaid: inv.amount_paid,
          balanceDue: inv.balance_due,
          dueDate: inv.due_date,
        });
      } catch (e) { console.error("Auto reminder failed for invoice", inv.id, e); }
    }
    if (unpaid.length) console.log(`Auto email reminders sent: ${unpaid.length}`);
  } catch (e) { console.error("sendAutoEmailReminders error:", e); }
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
