import { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { ApiError } from "../shared/ApiError.js";
import { env } from "../config/env.js";

type ErrorResponsePayload = {
  success: false;
  message: string;
  stack?: string;
  error?: unknown;
};

export const globalErrorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Something went wrong";
  let isOperational = false;
  let stack: string | undefined = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
    stack = err.stack;
  } else if (err instanceof Error) {
    message = err.message;
    stack = err.stack;
  }

  // In production, mask non-operational errors
  if (env.NODE_ENV === "production" && !isOperational) {
    statusCode = 500;
    message = "Something went wrong";
  }

  const responsePayload: ErrorResponsePayload = {
    success: false,
    message,
  };

  if (env.NODE_ENV === "development") {
    responsePayload.stack = stack;
    responsePayload.error = err;
  }

  res.status(statusCode).json(responsePayload);
};

export default globalErrorHandler;
