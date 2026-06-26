import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("job_posts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("student_id")
      .notNullable()
      .references("id")
      .inTable("student_profiles")
      .onDelete("CASCADE");
    table.enu("post_type", ["broadcast", "individual"]).notNullable();
    table
      .enu("status", ["open", "shortlisting", "closed", "completed", "cancelled"])
      .notNullable()
      .defaultTo("open");
    table.string("target_language_code", 10).notNullable();
    table.string("target_language_name", 100).notNullable();
    table.string("dialect_preference", 100).nullable();
    table
      .enu("current_level", ["newbie", "elementary", "intermediate", "advanced"])
      .notNullable();
    table.specificType("skill_gaps", "TEXT[]").notNullable().defaultTo("{}");
    table
      .enu("objective", ["relocation", "business", "exam_prep", "academic", "personal"])
      .notNullable();
    table.string("exam_target", 100).nullable();
    table.enu("frequency", ["casual", "standard", "intensive"]).notNullable();
    table.enu("duration", ["sprint", "season", "marathon"]).notNullable();
    table.enu("delivery_mode", ["online", "in_person", "flexible"]).notNullable();
    table.string("location_postcode", 20).nullable();
    table.string("location_district", 100).nullable();
    table.boolean("native_speaker_required").notNullable().defaultTo(false);
    table.decimal("budget_min", 8, 2).nullable();
    table.decimal("budget_max", 8, 2).nullable();
    table.text("additional_notes").nullable();
    table.integer("shortlist_capacity").notNullable().defaultTo(7);
    table.integer("shortlist_count").notNullable().defaultTo(0);
    table.integer("quote_count").notNullable().defaultTo(0);
    table.timestamp("expires_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("job_posts");
}
