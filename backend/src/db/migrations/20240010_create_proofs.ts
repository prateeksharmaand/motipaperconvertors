import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("proofs", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("tenants").onDelete("CASCADE");
    t.uuid("job_id").notNullable().references("id").inTable("job_cards").onDelete("CASCADE");
    t.enu("status", ["pending", "approved", "rejected", "revision_requested"])
      .notNullable()
      .defaultTo("pending");
    t.text("notes").nullable();
    t.uuid("actioned_by").nullable().references("id").inTable("users"); // staff acting on client's behalf
    t.timestamp("actioned_at").nullable();
    t.timestamps(true, true);

    t.index(["tenant_id", "job_id"]);
  });

  await knex.schema.createTable("proof_versions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("proof_id").notNullable().references("id").inTable("proofs").onDelete("CASCADE");
    t.integer("version_number").notNullable();
    t.string("file_url").notNullable(); // MinIO path
    t.string("file_name").nullable();
    t.string("file_type").nullable(); // pdf, jpg, png, ai
    t.uuid("uploaded_by").notNullable().references("id").inTable("users");
    t.text("comment").nullable();
    t.timestamp("uploaded_at").notNullable().defaultTo(knex.fn.now());

    t.unique(["proof_id", "version_number"]);
    t.index("proof_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("proof_versions");
  await knex.schema.dropTableIfExists("proofs");
}
