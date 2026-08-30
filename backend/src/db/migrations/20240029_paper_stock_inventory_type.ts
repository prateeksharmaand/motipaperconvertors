import type { Knex } from "knex";
export async function up(knex: Knex) {
  await knex.schema.alterTable("paper_stock", t => {
    t.enu("inventory_type", ["in_house", "external"]).notNullable().defaultTo("in_house");
  });
}
export async function down(knex: Knex) {
  await knex.schema.alterTable("paper_stock", t => {
    t.dropColumn("inventory_type");
  });
}
