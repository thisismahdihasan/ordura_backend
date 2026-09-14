import { jsonError, jsonSuccess } from "../components.js";
import { OpenApiPathMap } from "../docs.type.js";

const userData = {
  type: "object",
  required: ["user"],
  properties: { user: { $ref: "#/components/schemas/UserSummary" } },
};

export const authPaths: OpenApiPathMap = {
  "/api/v1/auth/register": {
    post: {
      tags: ["Auth"], summary: "Register a user and start a session",
      requestBody: {
        required: true,
        content: { "application/json": { schema: {
          type: "object", required: ["email", "password"], additionalProperties: false,
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string", minLength: 1 },
          },
        } } },
      },
      responses: {
        "201": jsonSuccess("User registered successfully. Sets the HTTP-only session cookie.", userData),
        "400": jsonError("Invalid registration body."),
        "409": jsonError("A user already exists for this email."),
        "429": jsonError("Registration rate limit exceeded."),
      },
    },
  },
  "/api/v1/auth/login": {
    post: {
      tags: ["Auth"], summary: "Log in and start a session",
      requestBody: {
        required: true,
        content: { "application/json": { schema: {
          type: "object", required: ["email", "password"], additionalProperties: false,
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        } } },
      },
      responses: {
        "200": jsonSuccess("Logged in successfully. Sets the HTTP-only session cookie.", userData),
        "400": jsonError("Invalid login body."),
        "401": jsonError("Invalid email or password."),
        "429": jsonError("Login rate limit exceeded."),
      },
    },
  },
  "/api/v1/auth/logout": {
    post: {
      tags: ["Auth"], summary: "Clear the current session cookie",
      responses: { "200": jsonSuccess("Logged out successfully.") },
    },
  },
  "/api/v1/auth/me": {
    get: {
      tags: ["Auth"], summary: "Get the current authenticated user",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": jsonSuccess("Current user retrieved successfully.", userData),
        "401": jsonError("Authentication is required."),
      },
    },
  },
  "/api/v1/auth/forgot-password/request": {
    post: {
      tags: ["Auth"],
      summary: "Request a password reset verification code (Public)",
      description: "Public endpoint. Initiates password reset by dispatching a 6-digit OTP code to the user's email if an account exists. Always returns a generic success response to prevent account enumeration.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email"],
              additionalProperties: false,
              properties: {
                email: { type: "string", format: "email" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonSuccess(
          "If an account exists for this email, we have sent a verification code."
        ),
        "400": jsonError("Invalid request body."),
        "429": jsonError("Too many requests. Please try again later."),
      },
    },
  },
  "/api/v1/auth/forgot-password/verify": {
    post: {
      tags: ["Auth"],
      summary: "Verify password reset OTP code (Public)",
      description: "Public endpoint. Verifies the 6-digit email OTP and produces a short-lived opaque reset token. Does not issue an auth cookie.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "code"],
              additionalProperties: false,
              properties: {
                email: { type: "string", format: "email" },
                code: {
                  type: "string",
                  pattern: "^\\d{6}$",
                  description: "6-digit numeric OTP",
                  example: "123456",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonSuccess("Verification successful.", {
          type: "object",
          required: ["resetToken"],
          properties: {
            resetToken: {
              type: "string",
              description: "Opaque single-use password reset token (10-minute TTL)",
            },
          },
        }),
        "400": jsonError("Invalid or expired verification code."),
        "429": jsonError("Too many requests. Please try again later."),
      },
    },
  },
  "/api/v1/auth/forgot-password/reset": {
    post: {
      tags: ["Auth"],
      summary: "Reset user password with verified reset token (Public)",
      description: "Public endpoint. Verifies the reset token, updates the password hash, increments tokenVersion to invalidate existing sessions across all devices, and burns the token.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "resetToken", "password", "confirmPassword"],
              additionalProperties: false,
              properties: {
                email: { type: "string", format: "email" },
                resetToken: {
                  type: "string",
                  description: "Opaque single-use reset token returned from verify",
                },
                password: {
                  type: "string",
                  minLength: 8,
                  description: "New user password (minimum 8 characters)",
                },
                confirmPassword: {
                  type: "string",
                  minLength: 8,
                  description: "Must match password exactly",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonSuccess(
          "Password reset successfully. Please sign in with your new password."
        ),
        "400": jsonError("Reset session is invalid or expired."),
        "429": jsonError("Too many requests. Please try again later."),
      },
    },
  },
};
