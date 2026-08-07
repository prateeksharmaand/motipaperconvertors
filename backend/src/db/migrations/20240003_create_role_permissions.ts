import type { Knex } from "knex";

// Granular sub-admin permissions. Each row = one permission flag granted to a user.
// Only meaningful for role = 'sub_admin'. Owner and above bypass this table.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("role_permissions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    // Permission flags from the spec matrix
    t.enu("permission", [
      "jobs.view",
      "jobs.create",
      "jobs.edit",
      "jobs.delete",
      "quotation.view",
      "quotation.create",
      "quotation.edit_rates",
      "production.view",
      "production.update_status",
      "inventory.view",
      "inventory.edit",
      "inventory.create_po",
      "billing.view",
      "billing.create_invoice",
      "billing.record_payment",
      "clients.view",
      "clients.edit",
      "staff.view",
      "staff.manage",
      "reports.view_financial",
      "settings.edit",
    ]).notNullable();
    t.timestamp("granted_at").notNullable().defaultTo(knex.fn.now());
    t.uuid("granted_by").nullable().references("id").inTable("users");

    t.unique(["user_id", "permission"]);
    t.index(["tenant_id", "user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("role_permissions");
}
