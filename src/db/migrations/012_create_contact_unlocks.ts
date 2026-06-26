import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("contact_unlocks", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("quote_id").notNullable().references("id").inTable("quotes");
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
    table.string("tutor_phone", 20).nullable();
    table.string("tutor_email", 255).nullable();
    table.string("student_phone", 20).nullable();
    table.string("student_email", 255).nullable();
    table.timestamp("unlocked_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("contact_unlocks");
}
