import { Router } from "express";
import { getHealth } from "./health.controller.js";
import { catchAsync } from "../../utils/catchAsync.js";

const router: Router = Router();

router.get("/", catchAsync(getHealth));

export const HealthRoutes = router;
export default router;
