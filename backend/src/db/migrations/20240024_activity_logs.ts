import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("activity_logs", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    // ── Identity ──────────────────────────────────────────
    t.uuid("tenant_id").nullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.uuid("user_id").nullable();           // null for system/background events
    t.string("user_name").nullable();       // snapshot — survives user deletion
    t.string("user_email").nullable();
    t.string("user_role").nullable();

    // ── Action taxonomy ───────────────────────────────────
    t.string("category").notNullable();     // AUTH | USER | JOB | BILLING | INVENTORY | SECURITY | SYSTEM
    t.string("action").notNullable();       // LOGIN | JOB_CREATED | STATUS_CHANGED | etc.
    t.string("module").nullable();          // Job Cards | Billing | Inventory | Staff
    t.string("feature").nullable();         // Assignment | Status | Payment
    t.string("operation").nullable();       // CREATE | READ | UPDATE | DELETE
    t.string("description").nullable();     // human-readable summary

    // ── Entity ────────────────────────────────────────────
    t.string("entity_type").nullable();     // job_card | invoice | user | paper_stock
    t.string("entity_id").nullable();       // uuid or composite key
    t.string("entity_name").nullable();     // snapshot name/number e.g. "JC-10234"

    // ── Change tracking ───────────────────────────────────
    t.jsonb("before").nullable();
    t.jsonb("after").nullable();
    t.specificType("changed_fields", "text[]").nullable(); // array of changed field names

    // ── Request context ───────────────────────────────────
    t.string("ip_address").nullable();
    t.string("user_agent").nullable();
    t.string("source").nullable().defaultTo("WEB"); // WEB | MOBILE | API | SYSTEM | BACKGROUND
    t.string("request_id").nullable();
    t.string("http_method").nullable();
    t.string("http_path").nullable();
    t.integer("response_status").nullable();
    t.integer("duration_ms").nullable();

    // ── Result ────────────────────────────────────────────
    t.string("status").notNullable().defaultTo("SUCCESS"); // SUCCESS | FAILED | DENIED
    t.text("error_message").nullable();

    // ── Metadata ──────────────────────────────────────────
    t.jsonb("metadata").nullable();         // arbitrary extra context

    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    // ── Indexes ───────────────────────────────────────────
    t.index(["tenant_id", "created_at"]);
    t.index(["tenant_id", "user_id", "created_at"]);
    t.index(["tenant_id", "entity_type", "entity_id"]);
    t.index(["tenant_id", "category", "action"]);
    t.index(["tenant_id", "module"]);
    t.index(["status"]);
    t.index("created_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("activity_logs");
}
