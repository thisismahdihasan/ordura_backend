import express, { Router } from "express";
import { HealthRoutes } from "../modules/health/health.route.js";

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
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
