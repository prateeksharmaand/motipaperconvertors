import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { authenticate } from "./middleware/authenticate.js";
import { startScheduledNotifications } from "./lib/scheduledNotifications.js";

import authRouter from "./routes/auth.js";
import jobsRouter from "./routes/jobs.js";
import quotationsRouter from "./routes/quotations.js";
import usersRouter from "./routes/users.js";
import clientsRouter from "./routes/clients.js";
import machinesRouter from "./routes/machines.js";
import inventoryRouter from "./routes/inventory.js";
import billingRouter from "./routes/billing.js";
import reportsRouter from "./routes/reports.js";
import platformRouter from "./routes/platform.js";
import publicRouter from "./routes/public.js";
import settingsRouter from "./routes/settings.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(",") ?? "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// ── Public (no auth) ──────────────────────────────────────
app.use("/api/v1/public", publicRouter);
app.use("/api/v1/auth", authRouter);

// ── All routes below require authentication ───────────────
app.use(authenticate);

// Mobile API — operator / staff / owner use these
app.use("/api/v1/mobile/jobs", jobsRouter);
app.use("/api/v1/mobile/quotations", quotationsRouter);
app.use("/api/v1/mobile/clients", clientsRouter);
app.use("/api/v1/mobile/inventory", inventoryRouter);

// Admin panel API — same routers, different URL namespace; tenant scoping enforced inside
app.use("/api/v1/admin/jobs", jobsRouter);
app.use("/api/v1/admin/quotations", quotationsRouter);
app.use("/api/v1/admin/users", usersRouter);
app.use("/api/v1/admin/clients", clientsRouter);
app.use("/api/v1/admin/machines", machinesRouter);
app.use("/api/v1/admin/inventory", inventoryRouter);
app.use("/api/v1/admin/billing", billingRouter);
app.use("/api/v1/admin/reports", reportsRouter);
app.use("/api/v1/admin/settings", settingsRouter);

// Super Admin platform namespace
app.use("/api/v1/platform", platformRouter);

// ── Health check ──────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = parseInt(process.env.PORT ?? "3000");
app.listen(PORT, () => {
  console.log(`MotiPaper API running on :${PORT}`);
  // Start daily scheduled notifications (delivery due, overdue invoices, low stock)
  startScheduledNotifications();
});

export default app;
