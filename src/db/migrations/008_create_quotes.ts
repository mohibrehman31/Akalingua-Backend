import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("quotes", (table) => {
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
      .inTable("tutor_profiles")
      .onDelete("CASCADE");
    table
      .uuid("student_id")
      .notNullable()
      .references("id")
      .inTable("student_profiles");
    table
      .enu("status", ["pending", "shortlisted", "accepted", "rejected", "expired", "archived"])
      .notNullable()
      .defaultTo("pending");
    table.decimal("proposed_rate", 8, 2).notNullable();
    table.enu("rate_type", ["hourly", "package"]).notNullable().defaultTo("hourly");
    table.integer("package_sessions").nullable();
    table.text("cover_message").notNullable();
    table.boolean("template_used").notNullable().defaultTo(false);
    table.timestamp("expires_at", { useTz: true }).nullable();
    table.decimal("platform_fee_pct", 5, 2).nullable();
    table.decimal("lead_fee_amount", 8, 2).nullable();
    table.boolean("lead_fee_paid").notNullable().defaultTo(false);
    table.timestamp("lead_fee_paid_at", { useTz: true }).nullable();
    table.boolean("contact_unlocked").notNullable().defaultTo(false);
    table.timestamp("unlocked_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["job_post_id", "tutor_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("quotes");
}
