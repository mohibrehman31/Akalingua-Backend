import db from "../../config/database";
import redis from "../../config/redis";
import { RevealPurchase } from "./reveal.types";

export const getRevealFeeEur = async (): Promise<number> => {
  const row = await db("platform_settings").where({ key: "reveal_fee_eur" }).first();
  return row ? Number(row.value) : 5.0;
};

export const findPurchase = async (
  tutorId: string,
  jobPostId: string,
): Promise<RevealPurchase | undefined> => {
  return db<RevealPurchase>("reveal_purchases")
    .where({ tutor_id: tutorId, job_post_id: jobPostId })
    .first();
};

export const countCompetingQuotes = async (
  tutorId: string,
  jobPostId: string,
): Promise<number> => {
  const row = await db("quotes")
    .where({ job_post_id: jobPostId })
    .andWhereNot({ tutor_id: tutorId })
    .count<{ count: string }[]>("id as count")
    .first();
  return Number(row?.count ?? 0);
};

export const getCompetingRates = async (
  tutorId: string,
  jobPostId: string,
): Promise<number[]> => {
  const rows = await db("quotes")
    .where({ job_post_id: jobPostId })
    .andWhereNot({ tutor_id: tutorId })
    .select("proposed_rate");
  return rows.map((r: any) => Number(r.proposed_rate));
};

export const recordPurchase = async (
  tutorId: string,
  jobPostId: string,
  pricePaid: number,
  stripeChargeId: string,
): Promise<RevealPurchase> => {
  const [row] = await db<RevealPurchase>("reveal_purchases")
    .insert({
      tutor_id: tutorId,
      job_post_id: jobPostId,
      price_paid: pricePaid,
      stripe_charge_id: stripeChargeId,
    } as any)
    .returning("*");
  return row;
};

export const getCachedRates = async (
  jobPostId: string,
): Promise<number[] | null> => {
  const cached = await redis.get(`reveal:${jobPostId}`);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
};

export const setCachedRates = async (
  jobPostId: string,
  rates: number[],
): Promise<void> => {
  await redis.set(`reveal:${jobPostId}`, JSON.stringify(rates), "EX", 300);
};
