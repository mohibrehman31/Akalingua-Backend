import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import db from "../../config/database";
import redis from "../../config/redis";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as authService from "./auth.service";
import { enqueueJob } from "../../jobs/queue";

const registerStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone_number: z.string().min(7),
  phone_country_code: z.string().default("+353"),
});

const registerTutorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone_number: z.string().min(7).optional(),
  phone_country_code: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const verifyOtpSchema = z.object({
  code: z.string().min(4).max(8),
  channel: z.enum(["phone", "email"]).optional(),
});

const phoneRequestSchema = z.object({
  phone: z.string().min(7),
  country_code: z.string().optional(),
});

const phoneVerifySchema = z.object({
  phone: z.string().min(7),
  code: z.string().min(4).max(8),
});

/** The public `User` payload the frontend's typed contract expects. */
const toUserPayload = (user: any) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  is_email_verified: user.is_email_verified,
  is_phone_verified: user.is_phone_verified,
  created_at: user.created_at,
});

const issueSession = async (user: any) => {
  const access_token = authService.generateAccessToken(user.id, user.role);
  const refresh_token = await authService.generateRefreshToken(user.id);
  return { access_token, refresh_token, user: toUserPayload(user) };
};

export const registerStudent = async (req: Request, res: Response) => {
  const parsed = registerStudentSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, first_name, last_name, phone_number, phone_country_code } =
    parsed.data;

  const existing = await db("users").where({ email }).first();
  if (existing)
    return res.status(409).json({ message: "Email already registered" });

  const password_hash = await authService.hashPassword(password);
  const [user] = await db("users")
    .insert({ email, password_hash, role: "student", phone_number, phone_country_code })
    .returning("*");

  await db("student_profiles").insert({ user_id: user.id, first_name, last_name });

  // Send the verification code; the student can complete OTP later from the dashboard.
  const otp = authService.generateOTP();
  await authService.storeOTP(user.id, otp);
  await enqueueJob("SEND_OTP", {
    userId: user.id,
    phone: `${phone_country_code}${phone_number}`,
    otp,
  });

  res.status(201).json(await issueSession(user));
};

export const registerTutor = async (req: Request, res: Response) => {
  const parsed = registerTutorSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, first_name, last_name, phone_number, phone_country_code } =
    parsed.data;

  const existing = await db("users").where({ email }).first();
  if (existing)
    return res.status(409).json({ message: "Email already registered" });

  const password_hash = await authService.hashPassword(password);
  const [user] = await db("users")
    .insert({ email, password_hash, role: "tutor", phone_number, phone_country_code })
    .returning("*");

  // Fresh tutor starts at the API.md base completion of 20%.
  await db("tutor_profiles").insert({
    user_id: user.id,
    first_name,
    last_name,
    profile_completion_pct: 20,
  });

  await enqueueJob("SEND_EMAIL", {
    to: email,
    template: "VERIFICATION",
    variables: { first_name, user_id: user.id },
  });

  res.status(201).json(await issueSession(user));
};

export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await db("users").where({ email }).first();
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  if (!user.is_active || user.is_banned)
    return res.status(403).json({ message: "Account suspended" });

  const valid = await authService.comparePassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  await db("users").where({ id: user.id }).update({ last_login_at: new Date() });

  res.json(await issueSession(user));
};

export const refresh = async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  let decoded: any;
  try {
    decoded = jwt.verify(
      parsed.data.refresh_token,
      process.env.JWT_REFRESH_SECRET as string,
    );
  } catch (_) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }

  // The token must still be active in Redis (not rotated out / logged out).
  const exists = await redis.get(`refresh:${decoded.sub}:${decoded.jti}`);
  if (!exists)
    return res.status(401).json({ message: "Refresh token no longer valid" });

  const user = await db("users").where({ id: decoded.sub }).first();
  if (!user || !user.is_active || user.is_banned)
    return res.status(401).json({ message: "Account not accessible" });

  // Rotate: invalidate the presented token, issue a fresh pair.
  await authService.invalidateRefreshToken(decoded.sub, decoded.jti);
  const access_token = authService.generateAccessToken(user.id, user.role);
  const refresh_token = await authService.generateRefreshToken(user.id);
  res.json({ access_token, refresh_token });
};

export const me = async (req: AuthRequest, res: Response) => {
  const user = await db("users").where({ id: req.user!.id }).first();
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(toUserPayload(user));
};

export const verifyOTP = async (req: AuthRequest, res: Response) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const result = await authService.verifyOTP(req.user!.id, parsed.data.code);
  if (!result.success) return res.status(400).json({ message: result.error });

  const user = await db("users").where({ id: req.user!.id }).first();
  res.json({ user: toUserPayload(user) });
};

export const resendOTP = async (req: AuthRequest, res: Response) => {
  const rateLimitKey = `otp_resend:${req.user!.id}`;
  const recentlySent = await redis.get(rateLimitKey);
  if (recentlySent)
    return res
      .status(429)
      .json({ message: "Please wait 2 minutes before requesting another code" });

  const user = await db("users").where({ id: req.user!.id }).first();
  if (!user) return res.status(404).json({ message: "User not found" });

  const otp = authService.generateOTP();
  await authService.storeOTP(user.id, otp);
  await redis.set(rateLimitKey, "1", "EX", 120);

  await enqueueJob("SEND_OTP", {
    userId: user.id,
    phone: `${user.phone_country_code ?? ""}${user.phone_number ?? ""}`,
    otp,
  });

  res.status(204).send();
};

export const logout = async (req: Request, res: Response) => {
  const { refresh_token } = req.body ?? {};
  if (refresh_token) {
    try {
      const decoded = jwt.verify(
        refresh_token,
        process.env.JWT_REFRESH_SECRET as string,
      ) as any;
      await authService.invalidateRefreshToken(decoded.sub, decoded.jti);
    } catch (_) {}
  }
  res.status(204).send();
};

// --- Standalone phone verification (Post-a-Request flow) -------------------

export const requestPhoneOtp = async (req: Request, res: Response) => {
  const parsed = phoneRequestSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const fullPhone = `${parsed.data.country_code ?? ""}${parsed.data.phone}`;
  const otp = authService.generateOTP();
  await authService.storePhoneOTP(fullPhone, otp);
  await enqueueJob("SEND_SMS", { phone: fullPhone, otp });

  const body: Record<string, any> = { sent: true, channel: "sms" };
  // The mock returns a dev_code so the flow is testable without real SMS.
  if (process.env.NODE_ENV !== "production") body.dev_code = otp;
  res.json(body);
};

export const verifyPhoneOtp = async (req: Request, res: Response) => {
  const parsed = phoneVerifySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const result = await authService.verifyPhoneOTP(parsed.data.phone, parsed.data.code);
  if (!result.success) return res.status(400).json({ message: result.error });
  res.json({ verified: true });
};
