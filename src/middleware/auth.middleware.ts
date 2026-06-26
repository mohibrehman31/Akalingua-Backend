import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "../config/database";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "student" | "tutor" | "admin";
    is_phone_verified: boolean;
    is_email_verified: boolean;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET as string,
    ) as any;
    const user = await db("users").where({ id: decoded.sub }).first();
    if (!user || !user.is_active || user.is_banned) {
      return res.status(401).json({ error: "Account not accessible" });
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      is_phone_verified: user.is_phone_verified,
      is_email_verified: user.is_email_verified,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

export const requirePhoneVerified = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user?.is_phone_verified) {
    return res.status(403).json({
      error: "PHONE_VERIFICATION_REQUIRED",
      message: "Please verify your phone number to continue",
    });
  }
  next();
};
