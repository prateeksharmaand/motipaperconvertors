import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("clients", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("company_name").nullable();
    t.string("phone").nullable();
    t.string("email").nullable();
    t.string("address").nullable();
    t.string("city").nullable();
    t.string("gstin").nullable();
    t.enu("status", ["active", "inactive"]).notNullable().defaultTo("active");
    t.decimal("credit_limit", 12, 2).notNullable().defaultTo(0);
    t.text("notes").nullable();
    t.timestamps(true, true);

    t.index("tenant_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("clients");
}
