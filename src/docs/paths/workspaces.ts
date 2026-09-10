import { jsonError, jsonSuccess } from "../components.js";
import { OpenApiPathMap } from "../docs.type.js";

const inviteBody = {
  type: "object", additionalProperties: false, required: ["email", "roles"],
  properties: {
    email: { type: "string", format: "email" },
    roles: { type: "array", minItems: 1, uniqueItems: true, items: { $ref: "#/components/schemas/WorkspaceRole" } },
  },
};

const inviteData = {
  type: "object", required: ["invite"], properties: {
    invite: { type: "object", required: ["id", "workspaceId", "email", "roles", "expiresAt", "createdAt"], properties: {
      id: { type: "string" }, workspaceId: { type: "string" }, email: { type: "string", format: "email" },
      roles: { type: "array", items: { $ref: "#/components/schemas/WorkspaceRole" } },
      expiresAt: { type: "string", format: "date-time" }, createdAt: { type: "string", format: "date-time" },
    } },
  },
};

export const workspacePaths: OpenApiPathMap = {
  "/api/v1/workspaces": {
    get: {
      tags: ["Workspaces"], summary: "List workspaces available to the current user",
      description: "Returns the authenticated user's explicit memberships for workspace and role restoration. Users with no memberships receive an empty workspaces array.",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": jsonSuccess("Workspaces retrieved successfully.", {
          type: "object", required: ["workspaces"], properties: {
            workspaces: { type: "array", items: { type: "object", required: ["id", "name", "ownerId", "createdAt", "updatedAt", "membership"], properties: {
              id: { type: "string" }, name: { type: "string" }, ownerId: { type: "string" },
              createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
              membership: { type: "object", required: ["id", "roles", "createdAt"], properties: {
                id: { type: "string" }, roles: { type: "array", items: { $ref: "#/components/schemas/WorkspaceRole" } }, createdAt: { type: "string", format: "date-time" },
              } },
            } } },
          },
        }),
        "401": jsonError("Authentication is required."),
      },
    },
    post: {
      tags: ["Workspaces"], summary: "Create a workspace", security: [{ cookieAuth: [] }],
      requestBody: { required: true, content: { "application/json": { schema: {
        type: "object", additionalProperties: false, required: ["name"],
        properties: { name: { type: "string", minLength: 1, maxLength: 100 } },
      } } } },
      responses: {
        "201": jsonSuccess("Workspace created successfully.", { type: "object", required: ["workspace", "membership"], properties: {
          workspace: { $ref: "#/components/schemas/Workspace" },
          membership: { $ref: "#/components/schemas/WorkspaceMembership" },
        } }),
        "400": jsonError("Invalid workspace body."), "401": jsonError("Authentication is required."),
        "409": jsonError("The user already owns a workspace."),
      },
    },
  },
  "/api/v1/workspace/invites": {
    post: {
      tags: ["Invites"], summary: "Create an invite for the caller's resolved admin workspace",
      description: "Fails when the caller administers multiple workspaces; use the workspace-scoped route instead.",
      security: [{ cookieAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: inviteBody } } },
      responses: { "201": jsonSuccess("Invite created and emailed successfully.", inviteData), "400": jsonError("Invalid invite body or ambiguous workspace."), "401": jsonError("Authentication is required."), "403": jsonError("Caller is not a workspace admin."), "409": jsonError("Member or active invite already exists."), "500": jsonError("Invitation email delivery failed.") },
    },
  },
  "/api/v1/workspace/invites/{token}/accept": {
    post: {
      tags: ["Invites"], summary: "Accept an emailed workspace invitation", security: [{ cookieAuth: [] }],
      parameters: [{ name: "token", in: "path", required: true, schema: { type: "string", minLength: 1 } }],
      responses: { "200": jsonSuccess("Invitation accepted successfully.", { type: "object", required: ["membership", "workspace", "invite"], properties: {
        membership: { $ref: "#/components/schemas/WorkspaceMembership" }, workspace: { $ref: "#/components/schemas/WorkspaceSummary" },
        invite: { type: "object", required: ["id", "acceptedAt"], properties: { id: { type: "string" }, acceptedAt: { type: "string", format: "date-time", nullable: true } } },
      } }), "400": jsonError("Invalid invitation."), "401": jsonError("Authentication is required."), "403": jsonError("Invitation belongs to another email."), "409": jsonError("Invitation was accepted or user is already a member."), "410": jsonError("Invitation expired.") },
    },
  },
  "/api/v1/workspaces/{workspaceId}/invites": {
    post: {
      tags: ["Invites"], summary: "Create a workspace-scoped invitation", security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/WorkspaceId" }], requestBody: { required: true, content: { "application/json": { schema: inviteBody } } },
      responses: { "201": jsonSuccess("Invite created and emailed successfully.", inviteData), "400": jsonError("Invalid invite body."), "401": jsonError("Authentication is required."), "403": jsonError("Explicit ADMIN role is required."), "409": jsonError("Member or active invite already exists."), "500": jsonError("Invitation email delivery failed.") },
    },
  },
  "/api/v1/workspaces/{workspaceId}/members": {
    get: {
      tags: ["Workspaces"],
      summary: "List workspace members",
      description: "ADMIN only. Returns safe membership data for the team directory in joined-date order.",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/WorkspaceId" }],
      responses: {
        "200": jsonSuccess("Workspace members retrieved successfully.", {
          type: "object",
          required: ["members"],
          properties: {
            members: {
              type: "array",
              items: {
                type: "object",
                required: ["membershipId", "userId", "name", "email", "roles", "joinedAt"],
                properties: {
                  membershipId: { type: "string" },
                  userId: { type: "string" },
                  name: { type: "string", nullable: true },
                  email: { type: "string", format: "email" },
                  roles: { type: "array", items: { $ref: "#/components/schemas/WorkspaceRole" } },
                  joinedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        }),
        "401": jsonError("Authentication is required."),
        "403": jsonError("Explicit ADMIN role is required."),
      },
    },
  },
};
