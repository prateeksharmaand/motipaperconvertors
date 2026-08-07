import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    // null tenant_id = super admin (platform-wide)
    t.uuid("tenant_id").nullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("email").nullable();
    t.string("phone").nullable();
    t.string("password_hash").nullable(); // null for OTP-only users
    t.enu("role", ["super_admin", "owner", "sub_admin", "staff", "operator"]).notNullable();
    t.enu("status", ["active", "invited", "inactive"]).notNullable().defaultTo("invited");
    t.string("invite_token").nullable();
    t.timestamp("invite_expires_at").nullable();
    t.string("fcm_token").nullable(); // Firebase device token for push notifications
    t.timestamp("last_login_at").nullable();
    t.timestamps(true, true);

    t.index(["tenant_id", "role"]);
    t.index("email");
    t.index("phone");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("users");
}
