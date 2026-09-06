import express, { Router } from "express";
import { HealthRoutes } from "../modules/health/health.route.js";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { WorkspaceRoutes } from "../modules/workspace/workspace.route.js";

const router: Router = express.Router();

type ModuleRoute = {
  path: string;
  route: Router;
};

const moduleRoutes: ModuleRoute[] = [
  {
    path: "/health",
    route: HealthRoutes,
  },
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/workspaces",
    route: WorkspaceRoutes,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
