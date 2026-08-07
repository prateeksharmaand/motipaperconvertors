import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("tenants", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("name").notNullable();
    t.string("slug").notNullable().unique(); // used in subdomains / display
    t.string("phone").nullable();
    t.string("email").nullable();
    t.string("address").nullable();
    t.string("city").nullable();
    t.string("state").nullable();
    t.string("gstin").nullable();
    // plan/status kept for future paid tier — no paywall built now
    t.enu("plan", ["free", "starter", "pro"]).notNullable().defaultTo("free");
    t.enu("status", ["active", "suspended", "trial"]).notNullable().defaultTo("active");
    t.string("logo_url").nullable();
    t.jsonb("settings").notNullable().defaultTo("{}"); // tenant-level config
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("tenants");
}
