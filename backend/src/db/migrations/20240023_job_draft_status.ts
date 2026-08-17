import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add 'draft' to all job-related status enums safely using DO blocks
  await knex.raw(`
    DO $$ BEGIN
      ALTER TYPE job_cards_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'enquiry';
    EXCEPTION WHEN others THEN NULL; END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      ALTER TYPE job_status_history_to_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'enquiry';
    EXCEPTION WHEN others THEN NULL; END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      ALTER TYPE job_status_history_from_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'enquiry';
    EXCEPTION WHEN others THEN NULL; END $$;
  `);
}

export async function down(_knex: Knex): Promise<void> {
  // PostgreSQL does not support removing enum values — no-op
}
