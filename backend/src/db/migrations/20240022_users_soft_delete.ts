import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (t) => {
    t.timestamp("deleted_at").nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("deleted_at");
  });
}
