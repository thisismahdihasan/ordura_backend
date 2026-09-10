import { jsonError, jsonSuccess } from "../components.js";
import { OpenApiPathMap } from "../docs.type.js";

export const notificationPaths: OpenApiPathMap = {
  "/api/v1/notifications": {
    get: {
      tags: ["Notifications"], summary: "Get the current user's notifications", security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/Limit" }],
      responses: { "200": jsonSuccess("Notifications retrieved successfully.", { type: "object", required: ["items", "pagination", "unreadCount"], properties: { items: { type: "array", items: { $ref: "#/components/schemas/Notification" } }, pagination: { $ref: "#/components/schemas/Pagination" }, unreadCount: { type: "integer" } } }), "400": jsonError("Invalid notification query."), "401": jsonError("Authentication is required.") },
    },
  },
  "/api/v1/notifications/{notificationId}/read": {
    patch: {
      tags: ["Notifications"], summary: "Mark one owned notification as read", security: [{ cookieAuth: [] }],
      parameters: [{ name: "notificationId", in: "path", required: true, schema: { type: "string", minLength: 1 } }],
      responses: { "200": jsonSuccess("Notification marked as read.", { type: "object", required: ["id", "isRead"], properties: { id: { type: "string" }, isRead: { type: "boolean", enum: [true] } } }), "401": jsonError("Authentication is required."), "404": jsonError("Owned notification was not found.") },
    },
  },
  "/api/v1/notifications/read-all": {
    patch: {
      tags: ["Notifications"], summary: "Mark all owned notifications as read", security: [{ cookieAuth: [] }],
      responses: { "200": jsonSuccess("Notifications marked as read.", { type: "object", required: ["updatedCount"], properties: { updatedCount: { type: "integer" } } }), "401": jsonError("Authentication is required.") },
    },
  },
};
