import type { Knex } from "knex";
import bcrypt from "bcryptjs";

// Creates the platform super admin. Run once after first deploy.
// Change credentials immediately after first login.
export async function seed(knex: Knex): Promise<void> {
  const existing = await knex("users").where({ role: "super_admin" }).first();
  if (existing) return; // idempotent

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  await knex("users").insert({
    id: knex.raw("gen_random_uuid()"),
    tenant_id: null,
    name: "Super Admin",
    email: "admin@motipaper.in",
    password_hash: passwordHash,
    role: "super_admin",
    status: "active",
  });
}
