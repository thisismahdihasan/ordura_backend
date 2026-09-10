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
};
