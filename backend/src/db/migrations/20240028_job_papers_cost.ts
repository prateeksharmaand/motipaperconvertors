import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("job_papers", (t) => {
    t.decimal("paper_cost", 12, 2).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("job_papers", (t) => {
    t.dropColumn("paper_cost");
  });
}
