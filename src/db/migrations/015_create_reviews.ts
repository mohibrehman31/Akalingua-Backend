import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("reviews", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("tutor_id")
      .notNullable()
      .references("id")
      .inTable("tutor_profiles");
    table
      .uuid("student_id")
      .notNullable()
      .references("id")
      .inTable("student_profiles");
    table.uuid("job_post_id").notNullable().references("id").inTable("job_posts");
    table.integer("rating").notNullable();
    table.text("review_text").nullable();
    table.boolean("is_visible").notNullable().defaultTo(true);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "ALTER TABLE reviews ADD CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5)"
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("reviews");
}
