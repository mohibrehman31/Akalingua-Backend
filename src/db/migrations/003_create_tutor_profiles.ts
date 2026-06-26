import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("tutor_profiles", (table) => {
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
    table.text("bio").nullable();
    table.string("tagline", 255).nullable();
    table.decimal("hourly_rate_min", 8, 2).nullable();
    table.decimal("hourly_rate_max", 8, 2).nullable();
    table.string("currency", 3).notNullable().defaultTo("EUR");
    table.integer("years_of_experience").nullable();
    table.specificType("specialisations", "TEXT[]").notNullable().defaultTo("{}");
    table.specificType("student_age_groups", "TEXT[]").notNullable().defaultTo("{}");
    table.string("location_postcode", 20).nullable();
    table.string("location_district", 100).nullable();
    table.string("location_country", 100).nullable();
    table.boolean("teaches_online").notNullable().defaultTo(true);
    table.boolean("teaches_in_person").notNullable().defaultTo(false);
    table.integer("profile_completion_pct").notNullable().defaultTo(0);
    table.boolean("is_live").notNullable().defaultTo(false);
    table.boolean("is_identity_verified").notNullable().defaultTo(false);
    table.boolean("is_accelerator_subscriber").notNullable().defaultTo(false);
    table.timestamp("accelerator_expires_at", { useTz: true }).nullable();
    table.string("stripe_customer_id", 100).nullable();
    table.string("stripe_subscription_id", 100).nullable();
    table.decimal("overall_rating", 3, 2).notNullable().defaultTo(0.0);
    table.integer("total_reviews").notNullable().defaultTo(0);
    table.decimal("retention_score_pct", 5, 2).notNullable().defaultTo(0.0);
    table.integer("lessons_taught_count").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("tutor_profiles");
}
