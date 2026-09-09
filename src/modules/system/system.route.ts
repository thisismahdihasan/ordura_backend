import { Router } from "express";
import { requireCronSecret } from "../../middleware/requireCronSecret.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { cleanupReviewImages } from "./system.controller.js";

const router: Router = Router();

router.post(
  "/cleanup/reviews",
  requireCronSecret,
  catchAsync(cleanupReviewImages)
);

export const SystemRoutes = router;
export default router;
