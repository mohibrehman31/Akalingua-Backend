import type { Knex } from "knex";

const DEFAULT_SETTINGS: Array<{ key: string; value: string; description: string }> = [
  {
    key: "default_shortlist_capacity",
    value: "7",
    description: "Max tutors a student can shortlist per job post",
  },
  { key: "reveal_fee_eur", value: "5.00", description: "Cost for one Reveal purchase" },
  {
    key: "accelerator_fee_eur",
    value: "70.00",
    description: "Monthly Accelerator subscription price",
  },
  {
    key: "decision_pack_fee_eur",
    value: "4.99",
    description: "One-time Decision Pack price (3 extra slots)",
  },
  {
    key: "lead_fee_broadcast_pct",
    value: "7.5",
    description: "Platform fee % for broadcast leads",
  },
  {
    key: "lead_fee_individual_pct",
    value: "10.0",
    description: "Platform fee % for individual quote requests",
  },
  {
    key: "accelerator_head_start_minutes",
    value: "10",
    description: "Minutes Accelerator tutors see new leads before standard tier",
  },
  {
    key: "quote_expiry_hours",
    value: "24",
    description: "Hours before an unanswered quote expires",
  },
  {
    key: "job_post_expiry_days",
    value: "30",
    description: "Days before an open job post auto-closes",
  },
  { key: "otp_expiry_minutes", value: "10", description: "Minutes before an OTP code expires" },
  {
    key: "otp_max_attempts",
    value: "5",
    description: "Max wrong OTP attempts before lockout",
  },
  {
    key: "otp_resend_cooldown_seconds",
    value: "120",
    description: "Cooldown between OTP resend requests",
  },
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("platform_settings", (table) => {
    table.string("key", 100).primary();
    table.text("value").notNullable();
    table.text("description").nullable();
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid("updated_by").nullable().references("id").inTable("users");
  });

  await knex("platform_settings").insert(DEFAULT_SETTINGS);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("platform_settings");
}
