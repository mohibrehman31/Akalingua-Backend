import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("payments", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("user_id").notNullable().references("id").inTable("users");
    table
      .enu("payment_type", [
        "lead_fee",
        "reveal_fee",
        "accelerator_subscription",
        "decision_pack",
        "corporate_bundle",
        "keyword_boost",
      ])
      .notNullable();
    table.decimal("amount", 10, 2).notNullable();
    table.string("currency", 3).notNullable().defaultTo("EUR");
    table.string("stripe_payment_id", 100).nullable();
    table.string("stripe_invoice_id", 100).nullable();
    table
      .enu("status", ["pending", "succeeded", "failed", "refunded"])
      .notNullable()
      .defaultTo("pending");
    table.uuid("reference_id").nullable();
    table.string("reference_type", 100).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payments");
}
