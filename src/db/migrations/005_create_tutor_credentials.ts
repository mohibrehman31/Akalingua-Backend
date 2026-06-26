import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("tutor_credentials", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("tutor_id")
      .notNullable()
      .references("id")
      .inTable("tutor_profiles")
      .onDelete("CASCADE");
    table.string("credential_type", 100).nullable();
    table.string("title", 255).nullable();
    table.string("institution", 255).nullable();
    table.integer("issued_year").nullable();
    table.string("file_url", 500).nullable();
    table.boolean("is_verified").notNullable().defaultTo(false);
    table.timestamp("verified_at", { useTz: true }).nullable();
    table.uuid("verified_by").nullable().references("id").inTable("users");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("tutor_credentials");
}
