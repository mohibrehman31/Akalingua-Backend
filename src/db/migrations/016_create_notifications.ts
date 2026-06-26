import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("notifications", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("type", 100).notNullable();
    table.string("title", 255).nullable();
    table.text("body").nullable();
    table.boolean("is_read").notNullable().defaultTo(false);
    table.timestamp("read_at", { useTz: true }).nullable();
    table.jsonb("metadata").nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("notifications");
}
