import { jsonError, jsonSuccess } from "../components.js";
import { OpenApiPathMap } from "../docs.type.js";

export const notificationPaths: OpenApiPathMap = {
  "/api/v1/workspaces/{workspaceId}/notifications": {
    get: {
      tags: ["Notifications"], summary: "Get the current user's notifications", security: [{ cookieAuth: [] }],
      description: "Returns only notifications owned by the authenticated user in the requested workspace. Any current workspace member may access this endpoint.",
      parameters: [{ $ref: "#/components/parameters/WorkspaceId" }, { $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/Limit" }],
      responses: { "200": jsonSuccess("Notifications retrieved successfully.", { type: "object", required: ["items", "pagination", "unreadCount"], properties: { items: { type: "array", items: { $ref: "#/components/schemas/Notification" } }, pagination: { $ref: "#/components/schemas/Pagination" }, unreadCount: { type: "integer", description: "Unread notifications owned by the current user in this workspace." } } }), "400": jsonError("Invalid notification query."), "401": jsonError("Authentication is required."), "403": jsonError("Current workspace membership is required.") },
    },
  },
  "/api/v1/workspaces/{workspaceId}/notifications/{notificationId}/read": {
    patch: {
      tags: ["Notifications"], summary: "Mark one owned notification as read", security: [{ cookieAuth: [] }],
      description: "Idempotently marks one notification owned by the authenticated user in the requested workspace. The request body must be empty.",
      parameters: [{ $ref: "#/components/parameters/WorkspaceId" }, { name: "notificationId", in: "path", required: true, schema: { type: "string", minLength: 1 } }],
      responses: { "200": jsonSuccess("Notification marked as read.", { type: "object", required: ["id", "isRead"], properties: { id: { type: "string" }, isRead: { type: "boolean", enum: [true] } } }), "400": jsonError("Invalid notification path or non-empty request body."), "401": jsonError("Authentication is required."), "403": jsonError("Current workspace membership is required."), "404": jsonError("Owned workspace notification was not found.") },
    },
  },
  "/api/v1/workspaces/{workspaceId}/notifications/read-all": {
    patch: {
      tags: ["Notifications"], summary: "Mark all owned notifications as read", security: [{ cookieAuth: [] }],
      description: "Marks unread notifications owned by the authenticated user in the requested workspace as read. The request body must be empty.",
      parameters: [{ $ref: "#/components/parameters/WorkspaceId" }],
      responses: { "200": jsonSuccess("Notifications marked as read.", { type: "object", required: ["updatedCount"], properties: { updatedCount: { type: "integer" } } }), "400": jsonError("Invalid workspace path or non-empty request body."), "401": jsonError("Authentication is required."), "403": jsonError("Current workspace membership is required.") },
    },
  },
};
