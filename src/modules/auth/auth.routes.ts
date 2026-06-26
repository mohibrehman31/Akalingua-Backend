import { Router } from "express";
import * as authController from "./auth.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { rateLimit } from "express-rate-limit";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many attempts. Please wait 15 minutes." },
});

// Registration / login → { access_token, refresh_token, user }
router.post("/register/student", authController.registerStudent);
router.post("/register/tutor", authController.registerTutor);
router.post("/login", authLimiter, authController.login);

// Token lifecycle
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

// Account OTP (authenticated) — verifying flips both verified flags
router.post("/verify-otp", authenticate, authController.verifyOTP);
router.post("/resend-otp", authenticate, authController.resendOTP);

// Standalone phone verification (Post-a-Request flow) — public
router.post("/otp/request", authLimiter, authController.requestPhoneOtp);
router.post("/otp/verify", authController.verifyPhoneOtp);

export default router;
