import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("invoices", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.integer("invoice_number").notNullable();
    t.uuid("job_id").nullable().references("id").inTable("job_cards").onDelete("SET NULL");
    t.uuid("client_id").notNullable().references("id").inTable("clients").onDelete("RESTRICT");
    t.uuid("quotation_id").nullable().references("id").inTable("quotations").onDelete("SET NULL");
    t.uuid("created_by").notNullable().references("id").inTable("users");

    t.enu("invoice_type", ["job_work", "goods"]).notNullable().defaultTo("job_work");
    t.enu("status", ["draft", "issued", "partially_paid", "paid", "cancelled"]).notNullable().defaultTo("draft");

    t.jsonb("line_items").notNullable().defaultTo("[]");
    t.decimal("sub_total", 12, 2).notNullable().defaultTo(0);
    t.decimal("discount_amount", 12, 2).notNullable().defaultTo(0);
    t.decimal("gst_percent", 5, 2).notNullable().defaultTo(18);
    t.decimal("gst_amount", 12, 2).notNullable().defaultTo(0);
    t.decimal("total", 12, 2).notNullable().defaultTo(0);
    t.decimal("amount_paid", 12, 2).notNullable().defaultTo(0);
    t.decimal("advance_adjusted", 12, 2).notNullable().defaultTo(0);
    t.decimal("balance_due", 12, 2).notNullable().defaultTo(0);

    t.date("issue_date").notNullable().defaultTo(knex.fn.now());
    t.date("due_date").nullable();
    t.string("pdf_url").nullable();
    t.text("notes").nullable();

    t.timestamps(true, true);

    t.unique(["tenant_id", "invoice_number"]);
    t.index(["tenant_id", "client_id"]);
    t.index(["tenant_id", "status"]);
  });

  await knex.schema.createTable("payments", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.uuid("client_id").notNullable().references("id").inTable("clients").onDelete("RESTRICT");
    t.uuid("invoice_id").nullable().references("id").inTable("invoices").onDelete("SET NULL");
    t.uuid("recorded_by").notNullable().references("id").inTable("users");

    t.decimal("amount", 12, 2).notNullable();
    t.enu("payment_mode", ["cash", "upi", "cheque", "neft", "rtgs", "other"]).notNullable();
    t.enu("type", ["advance", "against_invoice", "adjustment"]).notNullable().defaultTo("against_invoice");
    t.string("reference_number").nullable(); // cheque no, UTR, etc.
    t.date("payment_date").notNullable().defaultTo(knex.fn.now());
    t.text("notes").nullable();
    t.timestamps(true, true);

    t.index(["tenant_id", "client_id"]);
    t.index(["tenant_id", "invoice_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payments");
  await knex.schema.dropTableIfExists("invoices");
}
