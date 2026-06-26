import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("shortlist_slots", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("job_post_id")
      .notNullable()
      .references("id")
      .inTable("job_posts")
      .onDelete("CASCADE");
    table
      .uuid("student_id")
      .notNullable()
      .references("id")
      .inTable("student_profiles");
    table
      .uuid("tutor_id")
      .notNullable()
      .references("id")
      .inTable("tutor_profiles");
    table.uuid("quote_id").notNullable().references("id").inTable("quotes");
    table.integer("slot_position").notNullable();
    table.timestamp("added_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("removed_at", { useTz: true }).nullable();
    table.text("removal_reason").nullable();
    table.unique(["job_post_id", "tutor_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("shortlist_slots");
}
