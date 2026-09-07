import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  acceptWorkspaceInvite,
  createWorkspaceInvite,
} from "./workspaceInvite.controller.js";

const router: Router = Router();

router.post("/", requireAuth, catchAsync(createWorkspaceInvite));
router.post("/:token/accept", requireAuth, catchAsync(acceptWorkspaceInvite));

export const WorkspaceInviteRoutes = router;
export default router;

