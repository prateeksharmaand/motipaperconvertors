import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("job_papers", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("job_id").notNullable().references("id").inTable("job_cards").onDelete("CASCADE");
    t.uuid("paper_stock_id").notNullable().references("id").inTable("paper_stock").onDelete("RESTRICT");
    t.integer("sheet_count").notNullable();
    t.timestamps(true, true);
  });

  // Remove the single paper_stock_id column added in migration 20240020
  await knex.schema.alterTable("job_cards", (t) => {
    t.dropColumn("paper_stock_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("job_papers");
  await knex.schema.alterTable("job_cards", (t) => {
    t.uuid("paper_stock_id").nullable().references("id").inTable("paper_stock").onDelete("SET NULL");
  });
}
