import { Router } from "express";
import {
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
} from "./auth.controller.js";

const router: Router = Router();

router.post("/register", registerRateLimiter, catchAsync(registerUser));
router.post("/login", loginRateLimiter, catchAsync(loginUser));
router.post("/logout", catchAsync(logoutUser));
router.get("/me", requireAuth, catchAsync(getCurrentUser));

export const AuthRoutes = router;
export default router;
