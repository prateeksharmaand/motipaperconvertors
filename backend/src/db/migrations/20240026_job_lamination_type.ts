import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("job_cards", (t) => {
    t.string("lamination_type").nullable(); // 'glass' | 'matte'
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("job_cards", (t) => {
    t.dropColumn("lamination_type");
  });
}
