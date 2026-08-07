import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("quotations", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.integer("quotation_number").notNullable();
    t.uuid("job_id").notNullable().references("id").inTable("job_cards").onDelete("CASCADE");
    t.uuid("created_by").notNullable().references("id").inTable("users");
    t.enu("status", ["draft", "sent", "accepted", "rejected", "revised"]).notNullable().defaultTo("draft");

    // Paper / material
    t.decimal("paper_cost", 12, 2).notNullable().defaultTo(0);
    t.integer("sheets_required").nullable();
    t.decimal("wastage_percent", 5, 2).nullable();

    // Plate / pre-press
    t.integer("plate_count").nullable();
    t.decimal("plate_cost", 12, 2).notNullable().defaultTo(0);

    // Printing
    t.decimal("printing_cost", 12, 2).notNullable().defaultTo(0);

    // Finishing line items stored as JSONB array
    // [{ name: "Lamination", amount: 500 }, ...]
    t.jsonb("finishing_items").notNullable().defaultTo("[]");

    t.decimal("sub_total", 12, 2).notNullable().defaultTo(0);
    t.decimal("margin_percent", 5, 2).nullable();
    t.decimal("discount_amount", 12, 2).notNullable().defaultTo(0);
    t.decimal("gst_percent", 5, 2).notNullable().defaultTo(18);
    t.decimal("gst_amount", 12, 2).notNullable().defaultTo(0);
    t.decimal("total", 12, 2).notNullable().defaultTo(0);

    t.text("notes").nullable();
    t.string("pdf_url").nullable(); // MinIO path of generated PDF

    t.timestamps(true, true);

    t.unique(["tenant_id", "quotation_number"]);
    t.index(["tenant_id", "job_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("quotations");
}
