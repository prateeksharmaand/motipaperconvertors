import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("job_cards", (t) => {
    t.uuid("paper_stock_id").nullable().references("id").inTable("paper_stock").onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("job_cards", (t) => {
    t.dropColumn("paper_stock_id");
  });
}
