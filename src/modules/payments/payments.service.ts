import db from "../../config/database";
import { stripe } from "../../config/stripe";
import { enqueueJob } from "../../jobs/queue";
import { Payment } from "./payments.types";

export const getOrCreateStripeCustomerForTutor = async (
  tutorId: string,
): Promise<string> => {
  const tutor = await db("tutor_profiles as t")
    .innerJoin("users as u", "u.id", "t.user_id")
    .where("t.id", tutorId)
    .select(
      "t.id",
      "t.stripe_customer_id",
      "t.display_name",
      "t.first_name",
      "t.last_name",
      "u.email",
    )
    .first();

  if (!tutor) throw new Error("TUTOR_NOT_FOUND");

  if (tutor.stripe_customer_id) return tutor.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: tutor.email,
    name: tutor.display_name || `${tutor.first_name} ${tutor.last_name}`,
  });

  await db("tutor_profiles")
    .where({ id: tutorId })
    .update({ stripe_customer_id: customer.id, updated_at: new Date() });

  return customer.id;
};

export const handleLeadFeeSucceeded = async (
  pi: any,
): Promise<void> => {
  const quoteId = pi.metadata?.quote_id;
  if (!quoteId) return;

  await db.transaction(async (trx) => {
    const quote = await trx("quotes").where({ id: quoteId }).first();
    if (!quote) return;
    if (quote.lead_fee_paid) return;

    await trx("quotes").where({ id: quoteId }).update({
      lead_fee_paid: true,
      lead_fee_paid_at: new Date(),
      contact_unlocked: true,
      unlocked_at: new Date(),
      status: "accepted",
      updated_at: new Date(),
    });

    const tutor = await trx("tutor_profiles as t")
      .innerJoin("users as u", "u.id", "t.user_id")
      .where("t.id", quote.tutor_id)
      .select(
        "t.id",
        "t.display_name",
        "t.first_name",
        "u.id as user_id",
        "u.email",
        "u.phone_number",
        "u.phone_country_code",
      )
      .first();

    const student = await trx("student_profiles as sp")
      .innerJoin("users as u", "u.id", "sp.user_id")
      .where("sp.id", quote.student_id)
      .select(
        "sp.id",
        "sp.first_name",
        "u.id as user_id",
        "u.email",
        "u.phone_number",
        "u.phone_country_code",
      )
      .first();

    const tutorPhone =
      tutor && tutor.phone_number
        ? `${tutor.phone_country_code || ""}${tutor.phone_number}`
        : null;
    const studentPhone =
      student && student.phone_number
        ? `${student.phone_country_code || ""}${student.phone_number}`
        : null;

    await trx("contact_unlocks").insert({
      quote_id: quote.id,
      tutor_id: quote.tutor_id,
      student_id: quote.student_id,
      job_post_id: quote.job_post_id,
      tutor_phone: tutorPhone,
      tutor_email: tutor?.email ?? null,
      student_phone: studentPhone,
      student_email: student?.email ?? null,
    });

    await trx("payments").insert({
      user_id: tutor?.user_id ?? pi.metadata?.user_id,
      payment_type: "lead_fee",
      amount: Number(pi.amount) / 100,
      currency: (pi.currency || "eur").toUpperCase(),
      stripe_payment_id: pi.id,
      status: "succeeded",
      reference_id: quote.id,
      reference_type: "quote",
    });

    if (tutor && student) {
      await enqueueJob("SEND_EMAIL", {
        to_user_id: tutor.user_id,
        template: "CONTACT_UNLOCKED_TUTOR",
        variables: {
          tutor_name: tutor.display_name || tutor.first_name,
          student_phone: studentPhone,
          student_email: student.email,
        },
      });
      await enqueueJob("SEND_EMAIL", {
        to_user_id: student.user_id,
        template: "CONTACT_UNLOCKED_STUDENT",
        variables: {
          student_name: student.first_name,
          tutor_phone: tutorPhone,
          tutor_email: tutor.email,
        },
      });
      if (tutorPhone) {
        await enqueueJob("SEND_SMS", {
          to: tutorPhone,
          body: `You have unlocked ${student.first_name}'s contact details. Call them at ${studentPhone} to book your first session.`,
        });
      }
      if (studentPhone) {
        await enqueueJob("SEND_SMS", {
          to: studentPhone,
          body: `Great news! ${tutor.display_name || tutor.first_name} has accepted your request. Contact them at ${tutorPhone}.`,
        });
      }
    }
  });
};

export const handleSubscriptionUpsert = async (
  subscription: any,
): Promise<void> => {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const tutor = await db("tutor_profiles")
    .where({ stripe_customer_id: customerId })
    .first();
  if (!tutor) return;

  const isActive =
    subscription.status === "active" || subscription.status === "trialing";

  const item = subscription.items?.data?.[0];
  const periodEnd: number | null =
    (item as any)?.current_period_end ?? (subscription as any).current_period_end ?? null;
  const expiresAt = periodEnd ? new Date(periodEnd * 1000) : null;

  await db("tutor_profiles")
    .where({ id: tutor.id })
    .update({
      is_accelerator_subscriber: isActive,
      accelerator_expires_at: expiresAt,
      stripe_subscription_id: subscription.id,
      updated_at: new Date(),
    });
};

export const handleSubscriptionDeleted = async (
  subscription: any,
): Promise<void> => {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const tutor = await db("tutor_profiles")
    .where({ stripe_customer_id: customerId })
    .first();
  if (!tutor) return;

  await db("tutor_profiles").where({ id: tutor.id }).update({
    is_accelerator_subscriber: false,
    accelerator_expires_at: null,
    stripe_subscription_id: null,
    updated_at: new Date(),
  });
};

export const handleInvoicePaymentFailed = async (
  invoice: any,
): Promise<void> => {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const tutor = await db("tutor_profiles as t")
    .innerJoin("users as u", "u.id", "t.user_id")
    .where("t.stripe_customer_id", customerId)
    .select("u.id as user_id", "u.email")
    .first();
  if (!tutor) return;

  await enqueueJob("SEND_EMAIL", {
    to_user_id: tutor.user_id,
    template: "PAYMENT_FAILED",
    variables: { invoice_id: invoice.id, amount_due: Number(invoice.amount_due) / 100 },
  });
};

export const getPaymentsForUser = async (userId: string): Promise<any[]> => {
  return db<Payment>("payments")
    .where({ user_id: userId })
    .select("id", "payment_type", "amount", "currency", "status", "created_at")
    .orderBy("created_at", "desc");
};

const serializePayment = (row: any) => ({ ...row, amount: Number(row.amount) });

// Paginated history (API.md §9, limit=20), newest-first, amounts as numbers.
export const getPaymentsPage = async (
  userId: string,
  page: number,
  limit: number,
): Promise<{ data: any[]; total: number }> => {
  const base = db("payments").where({ user_id: userId });
  const totalRow = await base.clone().count<{ count: string }[]>("id as count").first();
  const rows = await base
    .clone()
    .select("id", "payment_type", "amount", "currency", "status", "created_at")
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset((page - 1) * limit);
  return { data: rows.map(serializePayment), total: Number(totalRow?.count ?? 0) };
};

export const markPaymentSucceeded = async (paymentId: string): Promise<void> => {
  await db("payments").where({ id: paymentId }).update({ status: "succeeded", updated_at: new Date() });
};

/**
 * Flips a quote to unlocked (lead fee paid → contact_unlocked, status=accepted).
 * Idempotent. Returns the user ids of both parties so the caller can notify them.
 */
export const unlockQuote = async (
  quoteId: string,
): Promise<{ alreadyUnlocked: boolean; studentUserId?: string; tutorUserId?: string } | null> => {
  return db.transaction(async (trx) => {
    const quote = await trx("quotes").where({ id: quoteId }).first();
    if (!quote) return null;

    const alreadyUnlocked = quote.contact_unlocked;
    if (!alreadyUnlocked) {
      await trx("quotes").where({ id: quoteId }).update({
        lead_fee_paid: true,
        lead_fee_paid_at: new Date(),
        contact_unlocked: true,
        unlocked_at: new Date(),
        status: "accepted",
        updated_at: new Date(),
      });
    }

    const tutor = await trx("tutor_profiles").where({ id: quote.tutor_id }).select("user_id").first();
    const student = await trx("student_profiles").where({ id: quote.student_id }).select("user_id").first();
    return { alreadyUnlocked, studentUserId: student?.user_id, tutorUserId: tutor?.user_id };
  });
};
