import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { acceptInvite, createInvite } from "./workspaceInvite.controller.js";

const router: Router = Router();

router.post("/", requireAuth, catchAsync(createInvite));
router.post("/:token/accept", requireAuth, catchAsync(acceptInvite));

export const WorkspaceInviteRoutes = router;
export default router;
