import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("machines", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("type").nullable(); // e.g. offset, digital, screen
    t.string("model").nullable();
    t.integer("max_sheet_width_mm").nullable();
    t.integer("max_sheet_height_mm").nullable();
    t.integer("max_colors").nullable();
    t.enu("status", ["active", "maintenance", "inactive"]).notNullable().defaultTo("active");
    t.text("notes").nullable();
    t.timestamps(true, true);

    t.index("tenant_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("machines");
}
