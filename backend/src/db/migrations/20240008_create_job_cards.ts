import type { Knex } from "knex";

// Tenant-scoped auto-increment job number implemented via a per-tenant sequence
// stored in a helper table, incremented in a transaction on job creation.
export async function up(knex: Knex): Promise<void> {
  // Tenant job number counter (gives each press its own numbering)
  await knex.schema.createTable("tenant_job_counters", (t) => {
    t.uuid("tenant_id").primary().references("id").inTable("tenants").onDelete("CASCADE");
    t.integer("last_job_number").notNullable().defaultTo(0);
    t.integer("last_quotation_number").notNullable().defaultTo(0);
    t.integer("last_challan_number").notNullable().defaultTo(0);
    t.integer("last_invoice_number").notNullable().defaultTo(0);
  });

  await knex.schema.createTable("job_cards", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.integer("job_number").notNullable(); // tenant-scoped sequential number
    t.uuid("client_id").nullable().references("id").inTable("clients").onDelete("SET NULL");
    t.uuid("machine_id").nullable().references("id").inTable("machines").onDelete("SET NULL");
    t.uuid("assigned_operator_id").nullable().references("id").inTable("users").onDelete("SET NULL");
    t.uuid("created_by").notNullable().references("id").inTable("users");

    t.string("title").notNullable();
    t.string("job_type").nullable(); // business card, brochure, banner, etc.
    t.text("description").nullable();

    t.enu("status", [
      "enquiry",
      "quotation",
      "design",
      "approval",
      "print",
      "finishing",
      "qc",
      "ready",
      "delivered",
      "cancelled",
    ]).notNullable().defaultTo("enquiry");

    t.integer("quantity").nullable();
    t.string("size").nullable();
    t.integer("colors_front").nullable();
    t.integer("colors_back").nullable();
    t.string("paper_type").nullable();
    t.string("finishing").nullable(); // lamination, UV, foil, etc.

    t.decimal("estimated_cost", 12, 2).nullable();
    t.decimal("quoted_price", 12, 2).nullable();
    t.decimal("actual_cost", 12, 2).nullable();

    t.date("due_date").nullable();
    t.timestamp("completed_at").nullable();

    // QR code is generated from job id — no separate column needed
    t.uuid("copied_from_job_id").nullable().references("id").inTable("job_cards");

    t.timestamps(true, true);

    t.unique(["tenant_id", "job_number"]);
    t.index(["tenant_id", "status"]);
    t.index(["tenant_id", "client_id"]);
  });

  await knex.schema.createTable("job_status_history", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("job_id").notNullable().references("id").inTable("job_cards").onDelete("CASCADE");
    t.uuid("changed_by").notNullable().references("id").inTable("users");
    t.enu("from_status", [
      "enquiry", "quotation", "design", "approval",
      "print", "finishing", "qc", "ready", "delivered", "cancelled",
    ]).nullable();
    t.enu("to_status", [
      "enquiry", "quotation", "design", "approval",
      "print", "finishing", "qc", "ready", "delivered", "cancelled",
    ]).notNullable();
    t.text("notes").nullable();
    t.timestamp("changed_at").notNullable().defaultTo(knex.fn.now());

    t.index("job_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("job_status_history");
  await knex.schema.dropTableIfExists("job_cards");
  await knex.schema.dropTableIfExists("tenant_job_counters");
}
