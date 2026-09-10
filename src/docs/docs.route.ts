import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument, swaggerUiDocument } from "./openapi.js";

const router = Router();

router.get("/api-docs.json", (_req, res) => {
  res.status(200).json(openApiDocument);
});

router.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerUiDocument, {
    swaggerOptions: { withCredentials: true },
  })
);

export const DocsRoutes = router;
export default router;
