import { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "../shared/ApiError.js";
import { env } from "../config/env.js";

type ErrorResponsePayload = {
  success: false;
  message: string;
  data?: Record<string, unknown>;
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
  let data: Record<string, unknown> | undefined = undefined;

  if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues.map((issue) => issue.message).join(", ") || "Validation failed";
    isOperational = true;
  } else if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    statusCode = 409;
    message = "A resource with this identifier already exists";
    isOperational = true;
  } else if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
    stack = err.stack;
    data = err.data;
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

  if (isOperational && data !== undefined) {
    responsePayload.data = data;
  }

  if (env.NODE_ENV === "development") {
    responsePayload.stack = stack;
    responsePayload.error = err;
  }

  res.status(statusCode).json(responsePayload);
};

export default globalErrorHandler;
