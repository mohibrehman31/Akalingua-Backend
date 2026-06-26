import type { Knex } from "knex";

const INDEXES: Array<{ name: string; sql: string }> = [
  { name: "idx_users_email", sql: "CREATE INDEX idx_users_email ON users(email)" },
  { name: "idx_users_role", sql: "CREATE INDEX idx_users_role ON users(role)" },
  {
    name: "idx_tutor_languages_code",
    sql: "CREATE INDEX idx_tutor_languages_code ON tutor_languages(language_code)",
  },
  {
    name: "idx_tutor_languages_tutor",
    sql: "CREATE INDEX idx_tutor_languages_tutor ON tutor_languages(tutor_id)",
  },
  {
    name: "idx_job_posts_student",
    sql: "CREATE INDEX idx_job_posts_student ON job_posts(student_id)",
  },
  {
    name: "idx_job_posts_status",
    sql: "CREATE INDEX idx_job_posts_status ON job_posts(status)",
  },
  {
    name: "idx_job_posts_language",
    sql: "CREATE INDEX idx_job_posts_language ON job_posts(target_language_code)",
  },
  {
    name: "idx_job_posts_created",
    sql: "CREATE INDEX idx_job_posts_created ON job_posts(created_at DESC)",
  },
  { name: "idx_quotes_job_post", sql: "CREATE INDEX idx_quotes_job_post ON quotes(job_post_id)" },
  { name: "idx_quotes_tutor", sql: "CREATE INDEX idx_quotes_tutor ON quotes(tutor_id)" },
  { name: "idx_quotes_status", sql: "CREATE INDEX idx_quotes_status ON quotes(status)" },
  {
    name: "idx_shortlist_job_post",
    sql: "CREATE INDEX idx_shortlist_job_post ON shortlist_slots(job_post_id)",
  },
  {
    name: "idx_shortlist_tutor",
    sql: "CREATE INDEX idx_shortlist_tutor ON shortlist_slots(tutor_id)",
  },
  {
    name: "idx_messages_thread",
    sql: "CREATE INDEX idx_messages_thread ON chat_messages(thread_id)",
  },
  {
    name: "idx_messages_created",
    sql: "CREATE INDEX idx_messages_created ON chat_messages(created_at DESC)",
  },
  {
    name: "idx_notifications_user",
    sql: "CREATE INDEX idx_notifications_user ON notifications(user_id)",
  },
  {
    name: "idx_notifications_unread",
    sql: "CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE",
  },
  { name: "idx_payments_user", sql: "CREATE INDEX idx_payments_user ON payments(user_id)" },
  {
    name: "idx_payments_stripe",
    sql: "CREATE INDEX idx_payments_stripe ON payments(stripe_payment_id)",
  },
  {
    name: "idx_keyword_boosts_active",
    sql: "CREATE INDEX idx_keyword_boosts_active ON keyword_boosts(keyword) WHERE is_active = TRUE",
  },
];

export async function up(knex: Knex): Promise<void> {
  for (const { sql } of INDEXES) {
    await knex.schema.raw(
      `DO $$ BEGIN ${sql}; EXCEPTION WHEN duplicate_table THEN NULL; END $$;`
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const { name } of [...INDEXES].reverse()) {
    await knex.schema.raw(`DROP INDEX IF EXISTS ${name}`);
  }
}
