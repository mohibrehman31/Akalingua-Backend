import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("tutor_languages", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("tutor_id")
      .notNullable()
      .references("id")
      .inTable("tutor_profiles")
      .onDelete("CASCADE");
    table.string("language_code", 10).notNullable();
    table.string("language_name", 100).notNullable();
    table.string("dialect", 100).nullable();
    table.enu("status", ["L1", "L2"]).notNullable();
    table.boolean("is_primary").notNullable().defaultTo(false);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("tutor_languages");
}
