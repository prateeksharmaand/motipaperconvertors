import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("delivery_challans", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.integer("challan_number").notNullable();
    t.uuid("job_id").notNullable().references("id").inTable("job_cards").onDelete("RESTRICT");
    t.uuid("client_id").notNullable().references("id").inTable("clients").onDelete("RESTRICT");
    t.uuid("dispatched_by").notNullable().references("id").inTable("users");

    t.enu("status", ["draft", "dispatched", "delivered", "partial"]).notNullable().defaultTo("draft");

    t.integer("total_quantity").nullable();
    t.integer("delivered_quantity").nullable();

    // QC checklist stored as JSONB
    t.jsonb("qc_checklist").notNullable().defaultTo("[]");

    t.string("receiver_name").nullable();
    t.string("receiver_signature_url").nullable(); // MinIO path
    t.string("delivery_address").nullable();
    t.timestamp("dispatched_at").nullable();
    t.timestamp("delivered_at").nullable();
    t.text("notes").nullable();
    t.string("pdf_url").nullable();

    t.timestamps(true, true);

    t.unique(["tenant_id", "challan_number"]);
    t.index(["tenant_id", "job_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("delivery_challans");
}
