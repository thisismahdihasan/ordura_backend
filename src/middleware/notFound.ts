import { Request, Response, NextFunction } from "express";
import { ApiError } from "../shared/ApiError.js";

export const notFound = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

export default notFound;
