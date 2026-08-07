import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("paper_stock", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.string("name").notNullable(); // e.g. "Art Paper 130gsm 23x36"
    t.string("brand").nullable();
    t.string("type").nullable(); // art, maplitho, bond, newsprint, etc.
    t.integer("gsm").nullable();
    t.string("size").nullable(); // e.g. "23x36 inches"
    t.integer("width_mm").nullable();
    t.integer("height_mm").nullable();
    t.string("unit").notNullable().defaultTo("sheets"); // sheets, kg, rolls
    t.decimal("quantity", 12, 2).notNullable().defaultTo(0);
    t.decimal("low_stock_threshold", 12, 2).notNullable().defaultTo(100);
    t.decimal("cost_per_unit", 12, 2).nullable();
    t.timestamps(true, true);

    t.index("tenant_id");
  });

  // ink, plates, other consumables in a generic inventory table
  await knex.schema.createTable("inventory_items", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.string("name").notNullable();
    t.enu("category", ["ink", "plate", "consumable", "other"]).notNullable();
    t.string("unit").notNullable().defaultTo("pcs");
    t.decimal("quantity", 12, 2).notNullable().defaultTo(0);
    t.decimal("low_stock_threshold", 12, 2).notNullable().defaultTo(10);
    t.decimal("cost_per_unit", 12, 2).nullable();
    t.timestamps(true, true);

    t.index("tenant_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("inventory_items");
  await knex.schema.dropTableIfExists("paper_stock");
}
