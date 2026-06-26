import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("interest_queue", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("job_post_id")
      .notNullable()
      .references("id")
      .inTable("job_posts")
      .onDelete("CASCADE");
    table
      .uuid("tutor_id")
      .notNullable()
      .references("id")
      .inTable("tutor_profiles");
    table.timestamp("queued_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("notified_at", { useTz: true }).nullable();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.unique(["job_post_id", "tutor_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("interest_queue");
}
