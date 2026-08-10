import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("clients", (t) => {
    t.boolean("email_reminder").notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("clients", (t) => {
    t.dropColumn("email_reminder");
  });
}
