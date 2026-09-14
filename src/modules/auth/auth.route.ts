import { Router } from "express";
import {
  forgotPasswordRequestRateLimiter,
  forgotPasswordResetRateLimiter,
  forgotPasswordVerifyRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
} from "../../middleware/authRateLimit.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetOtp,
} from "./auth.controller.js";

const router: Router = Router();

router.post("/register", registerRateLimiter, catchAsync(registerUser));
router.post("/login", loginRateLimiter, catchAsync(loginUser));
router.post("/logout", catchAsync(logoutUser));
router.get("/me", requireAuth, catchAsync(getCurrentUser));

router.post(
  "/forgot-password/request",
  forgotPasswordRequestRateLimiter,
  catchAsync(requestPasswordReset)
);
router.post(
  "/forgot-password/verify",
  forgotPasswordVerifyRateLimiter,
  catchAsync(verifyPasswordResetOtp)
);
router.post(
  "/forgot-password/reset",
  forgotPasswordResetRateLimiter,
  catchAsync(resetPassword)
);


export const AuthRoutes = router;
export default router;
