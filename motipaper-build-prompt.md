# MotiPaper — Full Build Prompt

Use this as the master prompt/spec to hand to a dev (or Claude Code) to scaffold and build the entire system.

---

## 1. What we're building

A work-management platform for small/mid printing presses in India, with four parts:

1. **Flutter mobile app** (Android + iOS only — no web/desktop targets) — used by press owners, staff, and machine operators
2. **Node.js backend API** — single backend serving the mobile app, admin panel, and public website
3. **Admin panel** (web) — used by the press owner and role-based sub-admins to manage everything
4. **Single-page marketing website** — public landing page for lead generation

---

## 2. Tech stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Mobile app | Flutter (Android + iOS only, no web/desktop build targets) |
| Backend | Node.js (TypeScript), REST API |
| Database | PostgreSQL |
| Admin panel | React (Vite) |
| Marketing site | Single static/SPA page, no CMS needed |
| Auth | JWT-based, role-based access control (RBAC) |
| Hosting | Self-managed VPS (single VPS to start — DB and app share the same instance; can split later if load requires it) |
| Deployment | Docker + Docker Compose |
| Reverse proxy / TLS | Nginx (+ Certbot for SSL) |
| File storage | Self-hosted MinIO on the same VPS (own Docker service) |
| Notifications | Firebase Cloud Messaging (push notifications) |

---

## 3. Multi-tenancy & roles

This is a **multi-tenant SaaS** — each printing press is a separate tenant (organization). Design the schema so one deployment serves many presses.

No billing/subscription plan for tenants right now — the app runs **free for all tenants** at this stage. Still model `tenants` with a `plan`/`status` field (e.g. `free`, `active`, `suspended`) so a paid tier can be introduced later without a schema rewrite, but build no paywall, plan limits, or payment-collection flow for now.

### Roles (RBAC)

| Role | Scope | Key permissions |
|---|---|---|
| **Super Admin** | Platform-wide | Manage all tenants (presses), view platform analytics, suspend/activate tenants, manage platform-level settings |
| **Owner** (tenant admin) | Single press | Full access within their press: jobs, clients, staff, machines, billing, reports, and — critically — can create/manage **Sub Admins** |
| **Sub Admin** | Single press, scoped | Owner assigns specific permissions per sub-admin (see permission matrix below). E.g. an accountant sub-admin sees billing/khata only; a production manager sees jobs/machines only |
| **Staff / Operator** | Single press, floor-level | Mobile-app only. Sees assigned machine queue, updates job status, logs wastage. No pricing/billing visibility |

No client-facing app or client account is required. Proof approval, order status, and invoices are handled by staff on behalf of the client (in person, over call, or by sharing a generated PDF/link manually) — there is no client role, login, or portal to build.

### Sub-admin permission matrix (granular, toggle-able by Owner)

Build permissions as discrete flags/modules the Owner can toggle per sub-admin, not fixed roles:
- `jobs.view`, `jobs.create`, `jobs.edit`, `jobs.delete`
- `quotation.view`, `quotation.create`, `quotation.edit_rates`
- `production.view`, `production.update_status`
- `inventory.view`, `inventory.edit`, `inventory.create_po`
- `billing.view`, `billing.create_invoice`, `billing.record_payment`
- `clients.view`, `clients.edit`
- `staff.view`, `staff.manage` (add/remove other staff — NOT other sub-admins; only Owner manages sub-admins)
- `reports.view_financial` (profit/margin data — sensitive, off by default)
- `settings.edit` (machines, paper types, rate cards)

Store as a `permissions JSONB` column on the sub-admin's user record, or a normalized `role_permissions` join table — prefer the join table for auditability.

---

## 4. Core modules (mirrors the job-card flow already validated)

1. **Auth & Onboarding** — tenant signup, Owner account creation, sub-admin/staff invites (email or SMS OTP)
2. **Job Card Management** — create job, auto job/order/quotation numbering (no more "NILL"), job-type presets, repeat-order copy, QR job ticket
3. **Quotation & Costing** — paper/sheet/wastage calculator, plate/printing/finishing line items, margin, PDF generation (shareable manually — download/print/share-sheet, no auto-send channel)
4. **Proof Approval** — artwork upload, versioning, in-app approve/reject by staff on the client's behalf, timestamped with comments (no client-facing link/login)
5. **Production Floor** — machine-wise job queues, operator mobile view, scan-to-update via QR, status pipeline (Enquiry → Quotation → Design → Approval → Print → Finishing → QC → Ready → Delivered), wastage logging
6. **Inventory** — stock by paper size/GSM/brand, ink, plates, rolls; auto-deduction on job completion; low-stock alerts with in-app + push notification; PO recorded in-app (shared with supplier manually)
7. **Delivery & Dispatch** — QC checklist, delivery challan (auto-numbered, never "Null"), partial delivery tracking, receiver signature capture
8. **Billing & Ledger (Khata)** — GST invoicing (job-work vs. goods), advance auto-adjustment, per-client running ledger, push-notification payment reminders to staff/owner (not the client) to follow up
9. **Reports** — job profitability (estimated vs. actual cost), machine utilization, outstanding payments, staff/machine-wise output (financial reports gated behind `reports.view_financial` permission)
10. **Admin Panel modules** — tenant settings, user & sub-admin management (with the permission matrix UI), machine/paper/rate-card configuration, audit log of sub-admin actions

---

## 5. Database (PostgreSQL) — top-level entity outline

Design normalized tables for at least: `tenants`, `users` (with `role` enum + `tenant_id`), `role_permissions`, `clients`, `machines`, `paper_stock`, `job_cards`, `job_status_history`, `quotations`, `proofs` (+ `proof_versions`), `invoices`, `payments`, `delivery_challans`, `inventory_transactions`, `audit_log`.

Key constraints:
- Every tenant-scoped table carries `tenant_id` with a foreign key and row-level filtering enforced at the query layer (or Postgres RLS if you want DB-level enforcement)
- `job_cards` gets a tenant-scoped auto-incrementing job number (not a global sequence) so each press sees its own numbering, matching how they already think about job cards
- `audit_log` records every sub-admin action (who, what, when) — Owners will want to see this given the trust being extended to sub-admins

---

## 6. API design

- RESTful JSON API, versioned (`/api/v1/...`)
- JWT auth with short-lived access token + refresh token
- Every endpoint enforces tenant scoping + permission check via middleware (don't rely on frontend hiding — enforce server-side)
- Separate route namespaces: `/api/v1/mobile/...` (app), `/api/v1/admin/...` (admin panel), `/api/v1/public/...` (marketing site lead capture only), `/api/v1/platform/...` (Super Admin only)
- Firebase Cloud Messaging (FCM) integration for push notifications: job assigned, proof needs approval, low stock, payment follow-up due, delivery due today — device tokens stored per user, sent server-side on relevant events

---

## 7. Flutter app

- Android + iOS only — explicitly exclude web/desktop/Linux/Windows targets when scaffolding (`flutter create --platforms=android,ios`)
- State management: your call, but be consistent (Riverpod or Bloc recommended for an app this size)
- Role-aware navigation: Owner/Sub-admin see full nav; Staff/Operator see a stripped-down floor view only
- Offline-tolerant for the operator/floor screens (spotty Wi-Fi on the shop floor) — queue status updates locally and sync
- Push notifications for job assignments, approval updates, low-stock alerts

---

## 8. Admin panel (web)

- Separate web app, same backend API, `/api/v1/admin/...`
- Owner-only screen: **Sub Admin management** — create sub-admin, assign permission toggles from the matrix in §3, deactivate/reactivate, view their audit trail
- Super Admin-only screen: tenant list, tenant health (active users, jobs/month), suspend/activate tenant

---

## 9. Marketing website

- Single page, no CMS, no backend dependency beyond a lead-capture form (POST to `/api/v1/public/leads`)
- Sections: hero, problem/solution (register vs. app), feature highlights, screenshots (reuse the demo flow), pricing (if decided), signup/demo CTA
- Static hosting is fine (served via the same Nginx, or a static bucket) — no need to run it through the Node app server

---

## 10. Infrastructure & deployment

- **VPS**: single Linux VPS to start (can split DB/app later)
- **Docker Compose services**: `postgres`, `backend` (Node API), `minio` (self-hosted file/image storage), `admin-panel` (served as static Vite build), `nginx`, optionally `redis` (for job queues / rate limiting)
- **Nginx**: reverse proxy for API + admin panel + marketing site, TLS via Certbot, separate subdomains recommended:
  - `api.motipaper.in` → backend
  - `admin.motipaper.in` → admin panel
  - `motipaper.in` → marketing site
- **Environment config**: `.env` per service, never committed; Docker secrets or `.env.production` on the VPS only
- **Backups**: scheduled `pg_dump` to off-VPS storage (cron + upload to object storage)
- **CI/CD**: keep it simple initially — git push → SSH deploy script that pulls, rebuilds Docker images, and restarts via `docker compose up -d --build`. Can formalize into GitHub Actions later
- **Logging/monitoring**: centralize container logs (Docker's `json-file` driver is fine to start; consider Loki/Grafana later)

---

## 11. Build sequencing (suggested order)

1. Postgres schema + migrations (tenants, users, roles/permissions first — everything else depends on this)
2. Node backend: auth + RBAC middleware + tenant scoping (get this right before building feature endpoints)
3. Job card + quotation modules (core value, matches validated demo flow)
4. Flutter app: Owner/staff views for job card + quotation + production
5. Firebase Cloud Messaging integration (job/proof/stock/payment/delivery notifications)
6. Inventory + billing/khata modules
7. Admin panel: sub-admin management + permission matrix UI
8. Reports
9. Marketing site
10. Dockerize everything, Nginx + TLS, deploy to VPS
11. Super Admin platform views (can trail — only needed once you have multiple tenants to manage)

---

## 12. Notes

All build decisions are now settled — admin panel (React/Vite), file storage (self-hosted MinIO), pricing (free for all tenants at this stage), and infra topology (single VPS) are fixed per above. Nothing left open before starting.
