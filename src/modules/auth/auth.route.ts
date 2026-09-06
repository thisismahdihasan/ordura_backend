import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { getMe, login, logout, register } from "./auth.controller.js";

const router: Router = Router();

router.post("/register", catchAsync(register));
router.post("/login", catchAsync(login));
router.post("/logout", catchAsync(logout));
router.get("/me", requireAuth, catchAsync(getMe));

export const AuthRoutes = router;
export default router;
