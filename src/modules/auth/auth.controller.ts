import { Request, Response } from "express";
import { z } from "zod";
import db from "../../config/database";
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
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const registerStudent = async (req: Request, res: Response) => {
  const parsed = registerStudentSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const {
    email,
    password,
    first_name,
    last_name,
    phone_number,
    phone_country_code,
  } = parsed.data;

  const existing = await db("users").where({ email }).first();
  if (existing)
    return res.status(409).json({ error: "Email already registered" });

  const password_hash = await authService.hashPassword(password);
  const [user] = await db("users")
    .insert({
      email,
      password_hash,
      role: "student",
      phone_number,
      phone_country_code,
    })
    .returning("*");

  await db("student_profiles").insert({
    user_id: user.id,
    first_name,
    last_name,
  });

  const otp = authService.generateOTP();
  await authService.storeOTP(user.id, otp);
  await enqueueJob("SEND_OTP", {
    userId: user.id,
    phone: `${phone_country_code}${phone_number}`,
    otp,
  });

  res.status(201).json({
    message: "Registration started. Enter the OTP sent to your phone.",
    user_id: user.id,
  });
};

export const registerTutor = async (req: Request, res: Response) => {
  const parsed = registerTutorSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, first_name, last_name } = parsed.data;

  const existing = await db("users").where({ email }).first();
  if (existing)
    return res.status(409).json({ error: "Email already registered" });

  const password_hash = await authService.hashPassword(password);
  const [user] = await db("users")
    .insert({
      email,
      password_hash,
      role: "tutor",
      is_email_verified: false,
    })
    .returning("*");

  await db("tutor_profiles").insert({
    user_id: user.id,
    first_name,
    last_name,
  });

  await enqueueJob("SEND_EMAIL", {
    to: email,
    template: "VERIFICATION",
    variables: { first_name, user_id: user.id },
  });

  const accessToken = authService.generateAccessToken(user.id, user.role);
  const refreshToken = await authService.generateRefreshToken(user.id);

  res
    .status(201)
    .json({
      message: "Tutor account created.",
      access_token: accessToken,
      refresh_token: refreshToken,
    });
};

export const verifyOTP = async (req: Request, res: Response) => {
  const { user_id, otp } = req.body;
  if (!user_id || !otp)
    return res.status(400).json({ error: "user_id and otp required" });

  const result = await authService.verifyOTP(user_id, otp);
  if (!result.success) return res.status(400).json({ error: result.error });

  const user = await db("users").where({ id: user_id }).first();
  await enqueueJob("SEND_EMAIL", {
    to: user.email,
    template: "WELCOME_STUDENT",
    variables: {},
  });

  const accessToken = authService.generateAccessToken(user.id, user.role);
  const refreshToken = await authService.generateRefreshToken(user.id);

  res.json({
    message: "Phone verified. Welcome to Akalingua.",
    access_token: accessToken,
    refresh_token: refreshToken,
  });
};

export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await db("users").where({ email }).first();
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (!user.is_active || user.is_banned)
    return res.status(403).json({ error: "Account suspended" });

  const valid = await authService.comparePassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  await db("users")
    .where({ id: user.id })
    .update({ last_login_at: new Date() });

  const accessToken = authService.generateAccessToken(user.id, user.role);
  const refreshToken = await authService.generateRefreshToken(user.id);

  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    role: user.role,
  });
};

export const logout = async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (refresh_token) {
    try {
      const decoded = require("jsonwebtoken").verify(
        refresh_token,
        process.env.JWT_REFRESH_SECRET,
      ) as any;
      await authService.invalidateRefreshToken(decoded.sub, decoded.jti);
    } catch (_) {}
  }
  res.json({ message: "Logged out" });
};

export const resendOTP = async (req: Request, res: Response) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  const rateLimitKey = `otp_resend:${user_id}`;
  const recentlySent = await redis.get(rateLimitKey);
  if (recentlySent)
    return res
      .status(429)
      .json({ error: "Please wait 2 minutes before requesting another OTP" });

  const user = await db("users").where({ id: user_id }).first();
  if (!user || user.is_phone_verified)
    return res.status(400).json({ error: "Invalid request" });

  const otp = authService.generateOTP();
  await authService.storeOTP(user.id, otp);
  await redis.set(rateLimitKey, "1", "EX", 120);

  await enqueueJob("SEND_OTP", {
    userId: user.id,
    phone: `${user.phone_country_code}${user.phone_number}`,
    otp,
  });

  res.json({ message: "OTP resent" });
};

import redis from "../../config/redis";
