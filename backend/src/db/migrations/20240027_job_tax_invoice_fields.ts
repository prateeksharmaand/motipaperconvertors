import { Knex } from "knex";

export async function up(knex: Knex) {
  await knex.schema.alterTable("job_cards", (t) => {
    t.string("tax_invoice_no").nullable();
    t.date("invoice_date").nullable();
  });
}

export async function down(knex: Knex) {
  await knex.schema.alterTable("job_cards", (t) => {
    t.dropColumn("tax_invoice_no");
    t.dropColumn("invoice_date");
  });
}
