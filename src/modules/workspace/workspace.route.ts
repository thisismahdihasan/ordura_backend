import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { create } from "./workspace.controller.js";

const router: Router = Router();

router.post("/", requireAuth, catchAsync(create));

export const WorkspaceRoutes = router;
export default router;
