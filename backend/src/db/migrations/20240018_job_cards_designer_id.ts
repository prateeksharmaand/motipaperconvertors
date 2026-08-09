import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("job_cards", (t) => {
    t.uuid("designer_id").nullable().references("id").inTable("users").onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("job_cards", (t) => {
    t.dropColumn("designer_id");
  });
}
