import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("tenant_settings", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.string("key").notNullable();   // "job_type" | "print_color"
    t.text("value").notNullable();   // the name string
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.index(["tenant_id", "key"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("tenant_settings");
}
