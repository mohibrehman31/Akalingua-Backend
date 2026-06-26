import type { Knex } from "knex";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

/**
 * Dev seed (spec §13). Mirrors the frontend mock so the real backend is a
 * drop-in for `VITE_USE_MOCK_API=false`. Accounts (all password `password`):
 *   student@akalingua.test  — student with active posts that have incoming quotes
 *   tutor@akalingua.test    — live tutor with quotes across statuses
 *                             (≥1 shortlisted-unpaid, ≥1 unlocked) + earnings
 *   admin@akalingua.test    — admin
 *
 * Re-runnable: wipes the domain graph (TRUNCATE … CASCADE) then re-inserts.
 */
export async function seed(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run dev seed in production");
  }

  // Wipe everything rooted at users (cascades to profiles, posts, quotes, …).
  await knex.raw("TRUNCATE TABLE users RESTART IDENTITY CASCADE");

  const password_hash = bcrypt.hashSync("password", 12);
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);
  const daysAhead = (n: number) => new Date(now + n * 24 * 60 * 60 * 1000);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // --- IDs (generated up-front so we can cross-link without round-trips) ----
  const studentUserId = uuidv4();
  const studentId = uuidv4();
  const tutorUserId = uuidv4();
  const tutorId = uuidv4();
  const t1UserId = uuidv4();
  const t1Id = uuidv4();
  const t2UserId = uuidv4();
  const t2Id = uuidv4();
  const adminUserId = uuidv4();

  const postAId = uuidv4(); // shortlisting — main tutor shortlisted (unpaid)
  const postBId = uuidv4(); // shortlisting — main tutor unlocked
  const postCId = uuidv4(); // open — main tutor pending

  const qAMain = uuidv4();
  const qAt1 = uuidv4();
  const qAt2 = uuidv4();
  const qBMain = uuidv4();
  const qBt1 = uuidv4();
  const qCMain = uuidv4();
  const qCt2 = uuidv4();

  // --- Users ---------------------------------------------------------------
  await knex("users").insert([
    {
      id: studentUserId,
      email: "student@akalingua.test",
      password_hash,
      role: "student",
      is_email_verified: true,
      is_phone_verified: true,
      phone_number: "871234567",
      phone_country_code: "+353",
      created_at: daysAgo(30),
    },
    {
      id: tutorUserId,
      email: "tutor@akalingua.test",
      password_hash,
      role: "tutor",
      is_email_verified: true,
      is_phone_verified: true,
      phone_number: "871112222",
      phone_country_code: "+353",
      created_at: daysAgo(60),
    },
    {
      id: t1UserId,
      email: "tutor.diana@akalingua.test",
      password_hash,
      role: "tutor",
      is_email_verified: true,
      is_phone_verified: true,
      created_at: daysAgo(45),
    },
    {
      id: t2UserId,
      email: "tutor.marco@akalingua.test",
      password_hash,
      role: "tutor",
      is_email_verified: true,
      is_phone_verified: true,
      created_at: daysAgo(40),
    },
    {
      id: adminUserId,
      email: "admin@akalingua.test",
      password_hash,
      role: "admin",
      is_email_verified: true,
      is_phone_verified: true,
      created_at: daysAgo(90),
    },
  ]);

  // --- Profiles ------------------------------------------------------------
  await knex("student_profiles").insert({
    id: studentId,
    user_id: studentUserId,
    first_name: "Sam",
    last_name: "Student",
    display_name: "Sam S.",
    location_district: "Dublin 2",
    location_country: "Ireland",
    created_at: daysAgo(30),
  });

  await knex("tutor_profiles").insert([
    {
      id: tutorId,
      user_id: tutorUserId,
      first_name: "Elena",
      last_name: "Vargas",
      display_name: "Elena V.",
      bio: "Native Spanish teacher with a decade of experience helping adults reach fluency for work and life abroad.",
      tagline: "Conversational Spanish that sticks",
      hourly_rate_min: 28,
      hourly_rate_max: 40,
      currency: "EUR",
      years_of_experience: 10,
      specialisations: ["business", "conversation", "exam_prep"],
      student_age_groups: ["adults"],
      location_district: "Dublin 4",
      location_country: "Ireland",
      teaches_online: true,
      teaches_in_person: true,
      profile_completion_pct: 90,
      is_live: true,
      is_identity_verified: true,
      is_accelerator_subscriber: true,
      accelerator_expires_at: daysAhead(25),
      overall_rating: 4.8,
      total_reviews: 24,
      retention_score_pct: 92,
      lessons_taught_count: 320,
      created_at: daysAgo(60),
    },
    {
      id: t1Id,
      user_id: t1UserId,
      first_name: "Diana",
      last_name: "Reyes",
      display_name: "Diana R.",
      bio: "Friendly Spanish tutor focused on relocation and everyday conversation.",
      tagline: "Speak from day one",
      hourly_rate_min: 24,
      hourly_rate_max: 34,
      currency: "EUR",
      years_of_experience: 6,
      specialisations: ["relocation", "conversation"],
      student_age_groups: ["adults", "teens"],
      location_country: "Spain",
      teaches_online: true,
      teaches_in_person: false,
      profile_completion_pct: 70,
      is_live: true,
      is_identity_verified: true,
      overall_rating: 4.6,
      total_reviews: 11,
      retention_score_pct: 85,
      lessons_taught_count: 140,
      created_at: daysAgo(45),
    },
    {
      id: t2Id,
      user_id: t2UserId,
      first_name: "Marco",
      last_name: "Bianchi",
      display_name: "Marco B.",
      bio: "Spanish and Italian tutor, exam-prep specialist (DELE).",
      tagline: "Exam-ready, stress-free",
      hourly_rate_min: 22,
      hourly_rate_max: 30,
      currency: "EUR",
      years_of_experience: 4,
      specialisations: ["exam_prep"],
      student_age_groups: ["adults"],
      location_country: "Italy",
      teaches_online: true,
      teaches_in_person: false,
      profile_completion_pct: 55,
      is_live: true,
      is_identity_verified: false,
      overall_rating: 4.4,
      total_reviews: 7,
      retention_score_pct: 78,
      lessons_taught_count: 60,
      created_at: daysAgo(40),
    },
  ]);

  // --- Tutor languages (all teach Spanish so they match the posts) ---------
  await knex("tutor_languages").insert([
    { tutor_id: tutorId, language_code: "es", language_name: "Spanish", status: "L1", is_primary: true },
    { tutor_id: tutorId, language_code: "en", language_name: "English", status: "L2", is_primary: false },
    { tutor_id: t1Id, language_code: "es", language_name: "Spanish", status: "L1", is_primary: true },
    { tutor_id: t2Id, language_code: "es", language_name: "Spanish", status: "L2", is_primary: true },
    { tutor_id: t2Id, language_code: "it", language_name: "Italian", status: "L1", is_primary: false },
  ]);

  // --- Tutor credential (verified → Verified badge + completion) -----------
  await knex("tutor_credentials").insert({
    tutor_id: tutorId,
    credential_type: "degree",
    title: "BA in Spanish Philology",
    institution: "Universidad Complutense de Madrid",
    issued_year: 2013,
    file_url: "https://example.com/dev/credential-elena.pdf",
    is_verified: true,
    verified_at: daysAgo(50),
    verified_by: adminUserId,
  });

  // --- Job posts -----------------------------------------------------------
  const basePost = {
    student_id: studentId,
    post_type: "broadcast" as const,
    target_language_code: "es",
    target_language_name: "Spanish",
    current_level: "intermediate" as const,
    skill_gaps: ["speaking", "listening"],
    objective: "business" as const,
    frequency: "standard" as const,
    duration: "season" as const,
    delivery_mode: "online" as const,
    native_speaker_required: false,
    budget_min: 25,
    budget_max: 40,
  };

  await knex("job_posts").insert([
    {
      ...basePost,
      id: postAId,
      status: "shortlisting",
      additional_notes: "Looking to get confident in client meetings before a move to Madrid.",
      shortlist_capacity: 7,
      shortlist_count: 1,
      quote_count: 3,
      expires_at: daysAhead(11),
      created_at: daysAgo(3),
    },
    {
      ...basePost,
      id: postBId,
      status: "shortlisting",
      objective: "relocation",
      additional_notes: "Relocating to Valencia, need conversational fluency fast.",
      shortlist_capacity: 7,
      shortlist_count: 1,
      quote_count: 2,
      expires_at: daysAhead(9),
      created_at: daysAgo(5),
    },
    {
      ...basePost,
      id: postCId,
      status: "open",
      objective: "exam_prep",
      exam_target: "DELE B2",
      additional_notes: "Preparing for DELE B2 in the autumn.",
      shortlist_capacity: 7,
      shortlist_count: 0,
      quote_count: 2,
      expires_at: daysAhead(12),
      created_at: daysAgo(2),
    },
  ]);

  // --- Quotes --------------------------------------------------------------
  const quote = (
    id: string,
    job_post_id: string,
    tutor_id: string,
    proposed_rate: number,
    status: string,
    extra: Record<string, any> = {},
  ) => ({
    id,
    job_post_id,
    tutor_id,
    student_id: studentId,
    status,
    proposed_rate,
    rate_type: "hourly",
    cover_message:
      "I'd love to help you reach your goal — here's how I'd structure our first month together.",
    expires_at: daysAhead(5),
    platform_fee_pct: 15,
    lead_fee_amount: round2(proposed_rate * 0.5),
    created_at: daysAgo(2),
    ...extra,
  });

  await knex("quotes").insert([
    // Post A: main tutor shortlisted (unpaid) + two pending competitors
    quote(qAMain, postAId, tutorId, 30, "shortlisted"),
    quote(qAt1, postAId, t1Id, 28, "pending"),
    quote(qAt2, postAId, t2Id, 25, "pending"),
    // Post B: main tutor accepted + unlocked, plus one competitor
    quote(qBMain, postBId, tutorId, 32, "accepted", {
      lead_fee_paid: true,
      lead_fee_paid_at: daysAgo(1),
      contact_unlocked: true,
      unlocked_at: daysAgo(1),
    }),
    quote(qBt1, postBId, t1Id, 27, "pending"),
    // Post C: main tutor pending + one competitor
    quote(qCMain, postCId, tutorId, 31, "pending"),
    quote(qCt2, postCId, t2Id, 24, "pending"),
  ]);

  // --- Shortlist slots (active) -------------------------------------------
  await knex("shortlist_slots").insert([
    {
      job_post_id: postAId,
      student_id: studentId,
      tutor_id: tutorId,
      quote_id: qAMain,
      slot_position: 1,
      added_at: daysAgo(1),
    },
    {
      job_post_id: postBId,
      student_id: studentId,
      tutor_id: tutorId,
      quote_id: qBMain,
      slot_position: 1,
      added_at: daysAgo(2),
    },
  ]);

  // --- Payments (main tutor; earnings/history non-empty) -------------------
  await knex("payments").insert([
    {
      user_id: tutorUserId,
      payment_type: "lead_fee",
      amount: round2(32 * 0.5),
      currency: "EUR",
      status: "succeeded",
      reference_id: qBMain,
      reference_type: "quote",
      stripe_payment_id: "pi_dev_leadfee_1",
      created_at: daysAgo(1),
    },
    {
      user_id: tutorUserId,
      payment_type: "accelerator_subscription",
      amount: 70,
      currency: "EUR",
      status: "succeeded",
      stripe_payment_id: "pi_dev_accel_1",
      created_at: daysAgo(4),
    },
    {
      user_id: tutorUserId,
      payment_type: "reveal_fee",
      amount: 4,
      currency: "EUR",
      status: "succeeded",
      reference_id: postAId,
      reference_type: "job_post",
      stripe_payment_id: "pi_dev_reveal_1",
      created_at: daysAgo(3),
    },
  ]);

  // --- Notifications -------------------------------------------------------
  await knex("notifications").insert([
    {
      user_id: studentUserId,
      type: "new_quote",
      title: "New quote on your request",
      body: "A tutor sent you a quote for your Spanish request.",
      is_read: false,
      metadata: JSON.stringify({ quote_id: qAt1, job_post_id: postAId }),
      created_at: daysAgo(2),
    },
    {
      user_id: studentUserId,
      type: "contact_unlocked",
      title: "Contact unlocked",
      body: "You can now message your shortlisted tutor.",
      is_read: false,
      metadata: JSON.stringify({ quote_id: qBMain }),
      created_at: daysAgo(1),
    },
    {
      user_id: tutorUserId,
      type: "shortlisted",
      title: "You've been shortlisted",
      body: "A student shortlisted your quote.",
      is_read: false,
      metadata: JSON.stringify({ quote_id: qAMain, job_post_id: postAId }),
      created_at: daysAgo(1),
    },
    {
      user_id: tutorUserId,
      type: "contact_unlocked",
      title: "Contact unlocked",
      body: "You unlocked a student's contact details.",
      is_read: true,
      read_at: daysAgo(1),
      metadata: JSON.stringify({ quote_id: qBMain }),
      created_at: daysAgo(1),
    },
  ]);
}
