import { Request, Response, NextFunction } from "express";
import { ApiError } from "../shared/ApiError.js";

// Catches unhandled routes and forwards a 404 ApiError to the global error handler.
export const notFound = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

export default notFound;
