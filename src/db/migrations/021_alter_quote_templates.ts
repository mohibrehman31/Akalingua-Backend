import type { Knex } from "knex";

// API.md QuoteTemplate is { id, name, cover_message, proposed_rate, rate_type }.
// The original table only had { title, content, language }; add the new columns
// and relax the old NOT NULLs so the documented payload can be inserted.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("quote_templates", (table) => {
    table.string("name", 255).nullable();
    table.text("cover_message").nullable();
    table.decimal("proposed_rate", 8, 2).nullable();
    table.string("rate_type", 20).nullable();
  });
  await knex.schema.alterTable("quote_templates", (table) => {
    table.string("title", 255).nullable().alter();
    table.text("content").nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("quote_templates", (table) => {
    table.dropColumn("name");
    table.dropColumn("cover_message");
    table.dropColumn("proposed_rate");
    table.dropColumn("rate_type");
  });
}
