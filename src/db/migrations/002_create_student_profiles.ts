import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("student_profiles", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("first_name", 100).notNullable();
    table.string("last_name", 100).notNullable();
    table.string("display_name", 100).nullable();
    table.string("avatar_url", 500).nullable();
    table.string("location_postcode", 20).nullable();
    table.string("location_district", 100).nullable();
    table.string("location_country", 100).nullable();
    table.boolean("is_premium").notNullable().defaultTo(false);
    table.timestamp("premium_expires_at", { useTz: true }).nullable();
    table.integer("extra_slots_count").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("student_profiles");
}
