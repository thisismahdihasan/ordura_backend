import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { createInvite } from "./workspaceInvite.controller.js";

const router: Router = Router();

router.post("/", requireAuth, catchAsync(createInvite));

export const WorkspaceInviteRoutes = router;
export default router;
