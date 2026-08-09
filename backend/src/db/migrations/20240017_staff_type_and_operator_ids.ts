import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add staff_type to users
  await knex.schema.alterTable("users", (t) => {
    t.string("staff_type").nullable();
  });

  // Add operator FK columns to job_cards
  await knex.schema.alterTable("job_cards", (t) => {
    t.uuid("print_operator_id").nullable().references("id").inTable("users").onDelete("SET NULL");
    t.uuid("binding_operator_id").nullable().references("id").inTable("users").onDelete("SET NULL");
    t.uuid("packing_operator_id").nullable().references("id").inTable("users").onDelete("SET NULL");
    t.uuid("qc_operator_id").nullable().references("id").inTable("users").onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("job_cards", (t) => {
    t.dropColumn("qc_operator_id");
    t.dropColumn("packing_operator_id");
    t.dropColumn("binding_operator_id");
    t.dropColumn("print_operator_id");
  });

  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("staff_type");
  });
}
