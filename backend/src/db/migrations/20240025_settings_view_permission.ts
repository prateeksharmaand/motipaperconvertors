import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Drop the old check constraint and re-add with settings.view included
  await knex.raw(`
    ALTER TABLE role_permissions
      DROP CONSTRAINT IF EXISTS role_permissions_permission_check;
  `);
  await knex.raw(`
    ALTER TABLE role_permissions
      ADD CONSTRAINT role_permissions_permission_check CHECK (permission IN (
        'jobs.view','jobs.create','jobs.edit','jobs.delete',
        'quotation.view','quotation.create','quotation.edit_rates',
        'production.view','production.update_status',
        'inventory.view','inventory.edit','inventory.create_po',
        'billing.view','billing.create_invoice','billing.record_payment',
        'clients.view','clients.edit',
        'staff.view','staff.manage',
        'reports.view_financial',
        'settings.view','settings.edit',
        'activity_log.view'
      ));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE role_permissions
      DROP CONSTRAINT IF EXISTS role_permissions_permission_check;
  `);
  await knex.raw(`
    ALTER TABLE role_permissions
      ADD CONSTRAINT role_permissions_permission_check CHECK (permission IN (
        'jobs.view','jobs.create','jobs.edit','jobs.delete',
        'quotation.view','quotation.create','quotation.edit_rates',
        'production.view','production.update_status',
        'inventory.view','inventory.edit','inventory.create_po',
        'billing.view','billing.create_invoice','billing.record_payment',
        'clients.view','clients.edit',
        'staff.view','staff.manage',
        'reports.view_financial',
        'settings.edit',
        'activity_log.view'
      ));
  `);
}
