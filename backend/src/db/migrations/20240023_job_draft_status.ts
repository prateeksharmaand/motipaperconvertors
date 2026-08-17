import type { Knex } from "knex";

const STATUSES = "'draft','enquiry','quotation','design','approval','print','finishing','qc','ready','delivered','cancelled'";

export async function up(knex: Knex): Promise<void> {
  // job_cards.status — drop old check, add new one with 'draft'
  await knex.raw(`ALTER TABLE job_cards DROP CONSTRAINT IF EXISTS job_cards_status_check`);
  await knex.raw(`ALTER TABLE job_cards ADD CONSTRAINT job_cards_status_check CHECK (status IN (${STATUSES}))`);

  // job_status_history.to_status
  await knex.raw(`ALTER TABLE job_status_history DROP CONSTRAINT IF EXISTS job_status_history_to_status_check`);
  await knex.raw(`ALTER TABLE job_status_history ADD CONSTRAINT job_status_history_to_status_check CHECK (to_status IN (${STATUSES}))`);

  // job_status_history.from_status
  await knex.raw(`ALTER TABLE job_status_history DROP CONSTRAINT IF EXISTS job_status_history_from_status_check`);
  await knex.raw(`ALTER TABLE job_status_history ADD CONSTRAINT job_status_history_from_status_check CHECK (from_status IN (${STATUSES}))`);
}

export async function down(knex: Knex): Promise<void> {
  const OLD = "'enquiry','quotation','design','approval','print','finishing','qc','ready','delivered','cancelled'";
  await knex.raw(`ALTER TABLE job_cards DROP CONSTRAINT IF EXISTS job_cards_status_check`);
  await knex.raw(`ALTER TABLE job_cards ADD CONSTRAINT job_cards_status_check CHECK (status IN (${OLD}))`);
  await knex.raw(`ALTER TABLE job_status_history DROP CONSTRAINT IF EXISTS job_status_history_to_status_check`);
  await knex.raw(`ALTER TABLE job_status_history ADD CONSTRAINT job_status_history_to_status_check CHECK (to_status IN (${OLD}))`);
  await knex.raw(`ALTER TABLE job_status_history DROP CONSTRAINT IF EXISTS job_status_history_from_status_check`);
  await knex.raw(`ALTER TABLE job_status_history ADD CONSTRAINT job_status_history_from_status_check CHECK (from_status IN (${OLD}))`);
}
