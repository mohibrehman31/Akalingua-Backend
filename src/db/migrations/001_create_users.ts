import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("email", 255).notNullable().unique();
    table.string("password_hash", 255).nullable();
    table.enu("role", ["student", "tutor", "admin"]).notNullable();
    table.boolean("is_email_verified").notNullable().defaultTo(false);
    table.boolean("is_phone_verified").notNullable().defaultTo(false);
    table.string("phone_number", 20).nullable();
    table.string("phone_country_code", 5).nullable();
    table.string("otp_code", 6).nullable();
    table.timestamp("otp_expires_at", { useTz: true }).nullable();
    table.integer("otp_attempts").notNullable().defaultTo(0);
    table.timestamp("last_login_at", { useTz: true }).nullable();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.boolean("is_banned").notNullable().defaultTo(false);
    table.text("ban_reason").nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("users");
}
