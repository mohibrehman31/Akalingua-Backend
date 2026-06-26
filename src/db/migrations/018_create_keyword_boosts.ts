import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("keyword_boosts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("tutor_id")
      .notNullable()
      .references("id")
      .inTable("tutor_profiles");
    table.string("keyword", 100).notNullable();
    table.timestamp("starts_at", { useTz: true }).nullable();
    table.timestamp("expires_at", { useTz: true }).nullable();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.uuid("payment_id").nullable().references("id").inTable("payments");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("keyword_boosts");
}
