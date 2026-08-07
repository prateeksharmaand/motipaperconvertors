import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("audit_log", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("action").notNullable(); // e.g. "job.status_changed", "invoice.created"
    t.string("entity_type").nullable(); // "job_card", "invoice", etc.
    t.uuid("entity_id").nullable();
    t.jsonb("before").nullable(); // snapshot before change
    t.jsonb("after").nullable(); // snapshot after change
    t.string("ip_address").nullable();
    t.string("user_agent").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.index(["tenant_id", "user_id"]);
    t.index(["tenant_id", "entity_type", "entity_id"]);
    t.index("created_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("audit_log");
}
