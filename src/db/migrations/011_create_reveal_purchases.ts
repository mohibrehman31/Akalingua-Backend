import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("reveal_purchases", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("job_post_id")
      .notNullable()
      .references("id")
      .inTable("job_posts");
    table
      .uuid("tutor_id")
      .notNullable()
      .references("id")
      .inTable("tutor_profiles");
    table.decimal("price_paid", 8, 2).notNullable().defaultTo(5.0);
    table.string("stripe_charge_id", 100).nullable();
    table.timestamp("purchased_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["job_post_id", "tutor_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("reveal_purchases");
}
