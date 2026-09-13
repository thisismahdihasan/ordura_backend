import { jsonError, jsonSuccess } from "../components.js";
import { OpenApiPathMap } from "../docs.type.js";

const itemParameters = [
  { $ref: "#/components/parameters/WorkspaceId" },
  { $ref: "#/components/parameters/ResearchItemId" },
];

const workflowErrors = {
  "401": jsonError("Authentication is required."),
  "403": jsonError("Explicit LISTER role and current assignment are required."),
  "404": jsonError("Research item was not found."),
  "409": jsonError("The current workflow state does not allow this action."),
};

export const listingPaths: OpenApiPathMap = {
  "/api/v1/workspaces/{workspaceId}/lister/my-work": {
    get: {
      tags: ["Listing"], summary: "Get the current lister's active queue", security: [{ cookieAuth: [] }],
      description: "LISTER only. Status filter accepts only READY_FOR_LISTING and LISTING_IN_PROGRESS; no completed/history queue exists.",
      parameters: [{ $ref: "#/components/parameters/WorkspaceId" }, { $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/Limit" }, { name: "search", in: "query", schema: { type: "string", maxLength: 100 } }, { name: "status", in: "query", schema: { type: "string", enum: ["READY_FOR_LISTING", "LISTING_IN_PROGRESS"] } }],
      responses: { "200": jsonSuccess("Lister work queue retrieved successfully.", { type: "object", required: ["items", "pagination"], properties: { items: { type: "array", items: { type: "object", required: ["assignmentId", "assignedAt", "startedAt", "researchItem", "preview", "finalAssets"], properties: { assignmentId: { type: "string" }, assignedAt: { type: "string", format: "date-time" }, startedAt: { type: "string", format: "date-time", nullable: true }, researchItem: { $ref: "#/components/schemas/ListerQueueResearchItem" }, preview: { $ref: "#/components/schemas/ListingApprovedPreview" }, finalAssets: { type: "array", items: { $ref: "#/components/schemas/SafeFinalAsset" } } } } }, pagination: { $ref: "#/components/schemas/Pagination" } } }), "400": jsonError("Invalid queue query."), "401": jsonError("Authentication is required."), "403": jsonError("Explicit LISTER role is required.") },
    },
  },
  "/api/v1/workspaces/{workspaceId}/listing/{researchItemId}": {
    get: {
      tags: ["Listing"],
      summary: "Get current Lister-owned active listing detail",
      security: [{ cookieAuth: [] }],
      description: "Explicit LISTER role and current ListingAssignment ownership are required. Only READY_FOR_LISTING and LISTING_IN_PROGRESS items are readable.",
      parameters: itemParameters,
      responses: {
        "200": jsonSuccess("Listing detail retrieved successfully.", {
          type: "object",
          required: [
            "researchItem", "creator", "designer", "listingAssignment",
            "approvedPreview", "finalAssets",
          ],
          properties: {
            researchItem: { $ref: "#/components/schemas/ListingDetailResearchItem" },
            creator: { $ref: "#/components/schemas/CreatedBySummary" },
            designer: { $ref: "#/components/schemas/NullableUserSummary" },
            listingAssignment: { $ref: "#/components/schemas/ListingAssignmentDetail" },
            approvedPreview: { $ref: "#/components/schemas/ListingApprovedPreview" },
            finalAssets: {
              type: "array",
              items: { $ref: "#/components/schemas/ListingDetailFinalAsset" },
            },
          },
        }),
        "401": jsonError("Authentication is required."),
        "403": jsonError("Explicit LISTER role and current assignment ownership are required."),
        "404": jsonError("Research item was not found in this workspace."),
        "409": jsonError("The item has no current assignment or is not in an active listing state."),
      },
    },
  },
  "/api/v1/workspaces/{workspaceId}/listing/backfill-assignments": {
    post: {
      tags: ["Listing"], summary: "Backfill unassigned listing assignments", security: [{ cookieAuth: [] }],
      description: "ADMIN only. Assigns currently unassigned READY_FOR_LISTING items without redistributing existing assignments.", parameters: [{ $ref: "#/components/parameters/WorkspaceId" }],
      responses: { "200": jsonSuccess("Unassigned listings backfilled successfully.", { type: "object", required: ["backfilledCount", "assignedItemIds"], properties: { backfilledCount: { type: "integer" }, assignedItemIds: { type: "array", items: { type: "string" } } } }), "401": jsonError("Authentication is required."), "403": jsonError("Explicit ADMIN role is required.") },
    },
  },
  "/api/v1/workspaces/{workspaceId}/listing/{researchItemId}/start": {
    post: {
      tags: ["Listing"], summary: "Start an assigned listing", security: [{ cookieAuth: [] }],
      description: "Current assigned lister only. READY_FOR_LISTING transitions to LISTING_IN_PROGRESS.", parameters: itemParameters,
      responses: { "200": jsonSuccess("Listing work started successfully.", { type: "object", required: ["researchItem", "assignment"], properties: { researchItem: { type: "object", required: ["id", "status"], properties: { id: { type: "string" }, status: { type: "string", enum: ["LISTING_IN_PROGRESS"] } } }, assignment: { type: "object", required: ["id", "startedAt"], properties: { id: { type: "string" }, startedAt: { type: "string", format: "date-time" } } } } }), ...workflowErrors },
    },
  },
  "/api/v1/workspaces/{workspaceId}/listing/{researchItemId}/complete": {
    post: {
      tags: ["Listing"], summary: "Complete an in-progress listing", security: [{ cookieAuth: [] }],
      description: "Current assigned lister only. LISTING_IN_PROGRESS transitions to LISTED. A duplicate result or completed assignment returns 409.", parameters: itemParameters,
      requestBody: { required: false, content: { "application/json": { schema: { type: "object", additionalProperties: false, properties: { etsyListingUrl: { type: "string", format: "uri", maxLength: 2048, nullable: true, description: "Optional Etsy listing URL; empty or omitted becomes null." } } } } } },
      responses: { "200": jsonSuccess("Listing completed successfully.", { type: "object", required: ["researchItem", "assignment", "listingResult"], properties: { researchItem: { type: "object", required: ["id", "status"], properties: { id: { type: "string" }, status: { type: "string", enum: ["LISTED"] } } }, assignment: { type: "object", required: ["id", "completedAt"], properties: { id: { type: "string" }, completedAt: { type: "string", format: "date-time" } } }, listingResult: { type: "object", required: ["id", "etsyListingUrl", "listedAt"], properties: { id: { type: "string" }, etsyListingUrl: { type: "string", format: "uri", nullable: true }, listedAt: { type: "string", format: "date-time" } } } } }), "400": jsonError("Invalid Etsy listing URL."), ...workflowErrors },
    },
  },
  "/api/v1/workspaces/{workspaceId}/listing/assets/{assetId}/download": {
    get: {
      tags: ["Listing"], summary: "Download an authorized private final asset", security: [{ cookieAuth: [] }],
      description: "Returns a binary attachment to the current assigned LISTER for a READY_FOR_LISTING, LISTING_IN_PROGRESS, or LISTED item.",
      parameters: [{ $ref: "#/components/parameters/WorkspaceId" }, { $ref: "#/components/parameters/AssetId" }],
      responses: { "200": { description: "Authorized binary attachment.", headers: { "Content-Type": { schema: { type: "string" }, description: "Recorded safe asset MIME type, with octet-stream fallback." }, "Content-Length": { schema: { type: "string" }, description: "Recorded byte length." }, "Content-Disposition": { schema: { type: "string" }, description: "Attachment filename disposition." } }, content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } }, "401": jsonError("Authentication is required."), "403": jsonError("Explicit LISTER role and current assignment are required."), "404": jsonError("Final asset or object was not found."), "409": jsonError("Final asset is unavailable at this workflow stage."), "502": jsonError("Storage retrieval failed."), "503": jsonError("Storage service is unavailable.") },
    },
  },
};
