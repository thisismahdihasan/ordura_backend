import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "./auth.controller.js";

const router: Router = Router();

router.post("/register", catchAsync(registerUser));
router.post("/login", catchAsync(loginUser));
router.post("/logout", catchAsync(logoutUser));
router.get("/me", requireAuth, catchAsync(getCurrentUser));

export const AuthRoutes = router;
export default router;
