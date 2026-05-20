import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "../../config/database";
import redis from "../../config/redis";

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (
  plain: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};

export const generateAccessToken = (userId: string, role: string): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_ACCESS_EXPIRY ||
      "15m") as SignOptions["expiresIn"],
  };
  return jwt.sign(
    { sub: userId, role },
    process.env.JWT_ACCESS_SECRET as string,
    options,
  );
};

export const generateRefreshToken = async (userId: string): Promise<string> => {
  const jti = uuidv4();
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRY ||
      "30d") as SignOptions["expiresIn"],
  };
  const token = jwt.sign(
    { sub: userId, jti },
    process.env.JWT_REFRESH_SECRET as string,
    options,
  );
  // Store in Redis — 30 days TTL
  await redis.set(`refresh:${userId}:${jti}`, "1", "EX", 60 * 60 * 24 * 30);
  return token;
};

export const invalidateRefreshToken = async (
  userId: string,
  jti: string,
): Promise<void> => {
  await redis.del(`refresh:${userId}:${jti}`);
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOTP = async (userId: string, otp: string): Promise<void> => {
  // Store in Redis with 10 minute TTL
  await redis.set(
    `otp:${userId}`,
    JSON.stringify({ code: otp, attempts: 0 }),
    "EX",
    600,
  );
  // Also store in DB as backup
  await db("users")
    .where({ id: userId })
    .update({
      otp_code: otp,
      otp_expires_at: new Date(Date.now() + 10 * 60 * 1000),
      otp_attempts: 0,
      updated_at: new Date(),
    });
};

export const verifyOTP = async (
  userId: string,
  submittedCode: string,
): Promise<{ success: boolean; error?: string }> => {
  const raw = await redis.get(`otp:${userId}`);
  if (!raw)
    return { success: false, error: "OTP expired. Please request a new one." };

  const { code, attempts } = JSON.parse(raw);
  if (attempts >= 5) {
    await redis.del(`otp:${userId}`);
    return {
      success: false,
      error: "Too many attempts. Please request a new OTP.",
    };
  }
  if (code !== submittedCode) {
    await redis.set(
      `otp:${userId}`,
      JSON.stringify({ code, attempts: attempts + 1 }),
      "KEEPTTL",
    );
    return { success: false, error: "Incorrect code. Please try again." };
  }

  await redis.del(`otp:${userId}`);
  await db("users").where({ id: userId }).update({
    is_phone_verified: true,
    otp_code: null,
    otp_expires_at: null,
    updated_at: new Date(),
  });
  return { success: true };
};
