import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("chat_threads", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("quote_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("quotes");
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
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("last_message_at", { useTz: true }).nullable();
  });

  await knex.schema.createTable("chat_messages", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("thread_id")
      .notNullable()
      .references("id")
      .inTable("chat_threads")
      .onDelete("CASCADE");
    table.uuid("sender_id").notNullable().references("id").inTable("users");
    table.enu("sender_role", ["student", "tutor"]).notNullable();
    table
      .enu("message_type", ["text", "document", "suggested_prompt", "system"])
      .notNullable()
      .defaultTo("text");
    table.text("content").nullable();
    table.string("attachment_url", 500).nullable();
    table.string("attachment_name", 255).nullable();
    table.boolean("is_read").notNullable().defaultTo(false);
    table.timestamp("read_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("chat_messages");
  await knex.schema.dropTableIfExists("chat_threads");
}
