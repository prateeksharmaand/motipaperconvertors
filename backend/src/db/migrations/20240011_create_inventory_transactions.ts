import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("inventory_transactions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    // either paper_stock or inventory_items, not both
    t.uuid("paper_stock_id").nullable().references("id").inTable("paper_stock").onDelete("SET NULL");
    t.uuid("inventory_item_id").nullable().references("id").inTable("inventory_items").onDelete("SET NULL");
    t.uuid("job_id").nullable().references("id").inTable("job_cards").onDelete("SET NULL");
    t.uuid("performed_by").notNullable().references("id").inTable("users");
    t.enu("type", ["in", "out", "adjustment", "wastage"]).notNullable();
    t.decimal("quantity", 12, 2).notNullable();
    t.decimal("unit_cost", 12, 2).nullable();
    t.text("notes").nullable();
    t.string("po_reference").nullable(); // PO number if this was a purchase
    t.timestamp("transacted_at").notNullable().defaultTo(knex.fn.now());

    t.index(["tenant_id", "paper_stock_id"]);
    t.index(["tenant_id", "inventory_item_id"]);
    t.index(["tenant_id", "job_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("inventory_transactions");
}
