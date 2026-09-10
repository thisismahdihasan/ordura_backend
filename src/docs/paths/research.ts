import { jsonError, jsonSuccess } from "../components.js";
import { OpenApiPathMap } from "../docs.type.js";

const workspaceAndResearchParameters = [
  { $ref: "#/components/parameters/WorkspaceId" },
  { $ref: "#/components/parameters/ResearchItemId" },
];

const researchReadItem = {
  allOf: [
    { $ref: "#/components/schemas/ResearchItemSafe" },
    {
      type: "object",
      required: ["createdBy", "currentDesigner", "currentDesignAssignment"],
      properties: {
        createdBy: { $ref: "#/components/schemas/CreatedBySummary" },
        currentDesigner: { $ref: "#/components/schemas/NullableUserSummary" },
        currentDesignAssignment: { $ref: "#/components/schemas/CurrentDesignAssignment" },
      },
    },
  ],
};

const researchListItem = {
  allOf: [
    researchReadItem,
    {
      type: "object",
      required: ["latestIssueReport"],
      properties: {
        latestIssueReport: {
          type: "object",
          nullable: true,
          required: ["id", "reason", "details", "createdAt", "reportedBy"],
          properties: {
            id: { type: "string" },
            reason: { $ref: "#/components/schemas/IssueReason" },
            details: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            reportedBy: { $ref: "#/components/schemas/CreatedBySummary" },
          },
        },
      },
    },
  ],
};

const researchDetailItem = {
  allOf: [
    researchReadItem,
    {
      type: "object",
      required: ["latestReview"],
      properties: {
        latestReview: { type: "object", nullable: true, required: ["id", "roundNumber", "imageUrl", "imageDeletedAt", "note", "submittedAt", "approvedAt", "approvedById"], properties: { id: { type: "string" }, roundNumber: { type: "integer" }, imageUrl: { type: "string", format: "uri", nullable: true }, imageDeletedAt: { type: "string", format: "date-time", nullable: true }, note: { type: "string", nullable: true }, submittedAt: { type: "string", format: "date-time" }, approvedAt: { type: "string", format: "date-time", nullable: true }, approvedById: { type: "string", nullable: true } } },
      },
    },
  ],
};

export const researchPaths: OpenApiPathMap = {
  "/api/v1/workspaces/{workspaceId}/research-items": {
    post: {
      tags: ["Research"], summary: "Create a research item from an Etsy listing", security: [{ cookieAuth: [] }],
      description: "Explicit ADMIN or RESEARCHER role required. New items are assigned to the least-loaded eligible designer when available; otherwise they remain RESEARCHED. A same-workspace duplicate returns 409 with duplicate metadata.",
      parameters: [{ $ref: "#/components/parameters/WorkspaceId" }],
      requestBody: { required: true, content: { "application/json": { schema: {
        type: "object", additionalProperties: false, required: ["etsyUrl"], properties: { etsyUrl: { type: "string", format: "uri", description: "HTTP(S) Etsy listing URL containing a numeric listing ID." } },
      } } } },
      responses: {
        "201": jsonSuccess("Research item created successfully.", { type: "object", required: ["researchItem"], properties: { researchItem: { allOf: [{ $ref: "#/components/schemas/ResearchItemSafe" }, { type: "object", required: ["createdById"], properties: { createdById: { type: "string" } } }] } } }),
        "400": jsonError("Invalid Etsy listing URL."), "401": jsonError("Authentication is required."), "403": jsonError("ADMIN or RESEARCHER role is required."),
        "409": { description: "The Etsy listing already exists in this workspace.", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiError" }, { type: "object", properties: { data: { type: "object", required: ["alreadyExists", "researchItemId", "createdBy", "currentStatus", "createdAt"], properties: { alreadyExists: { type: "boolean", enum: [true] }, researchItemId: { type: "string" }, createdBy: { $ref: "#/components/schemas/CreatedBySummary" }, currentStatus: { $ref: "#/components/schemas/ResearchStatus" }, createdAt: { type: "string", format: "date-time" } } } } }] } } } },
      },
    },
    get: {
      tags: ["Research"], summary: "List workspace research items", security: [{ cookieAuth: [] }],
      description: "Any explicit workspace workflow role may read this list.",
      parameters: [
        { $ref: "#/components/parameters/WorkspaceId" },
        { name: "createdBy", in: "query", schema: { type: "string", minLength: 1 } },
        { name: "status", in: "query", schema: { $ref: "#/components/schemas/ResearchStatus" } },
        { name: "date", in: "query", schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "UTC calendar date, YYYY-MM-DD." } },
        { name: "search", in: "query", schema: { type: "string" } },
        { $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/Limit" },
      ],
      responses: { "200": jsonSuccess("Research items retrieved successfully.", { type: "object", required: ["items", "pagination"], properties: { items: { type: "array", items: researchListItem }, pagination: { $ref: "#/components/schemas/Pagination" } } }), "400": jsonError("Invalid list query."), "401": jsonError("Authentication is required."), "403": jsonError("Workspace access is required.") },
    },
  },
  "/api/v1/workspaces/{workspaceId}/research-items/{researchItemId}": {
    get: {
      tags: ["Research"], summary: "Get one workspace research item", security: [{ cookieAuth: [] }], parameters: workspaceAndResearchParameters,
      responses: { "200": jsonSuccess("Research item retrieved successfully.", { type: "object", required: ["researchItem"], properties: { researchItem: researchDetailItem } }), "401": jsonError("Authentication is required."), "403": jsonError("Workspace access is required."), "404": jsonError("Research item was not found.") },
    },
  },
  "/api/v1/workspaces/{workspaceId}/research-items/{researchItemId}/reference-image": {
    get: {
      tags: ["Research"], summary: "Proxy a research reference image", security: [{ cookieAuth: [] }],
      description: "Returns a protected binary image. `download=true` or `download=1` uses attachment disposition; other accepted values use inline disposition.",
      parameters: [...workspaceAndResearchParameters, { name: "download", in: "query", schema: { type: "string", enum: ["true", "false", "1", "0"] } }],
      responses: { "200": { description: "Image stream with image Content-Type and Content-Disposition.", headers: { "Content-Disposition": { schema: { type: "string" } }, "Cache-Control": { schema: { type: "string" } } }, content: { "image/*": { schema: { type: "string", format: "binary" } } } }, "401": jsonError("Authentication is required."), "403": jsonError("Workspace access is required."), "404": jsonError("Item or reference image was not found."), "502": jsonError("Reference image could not be safely loaded."), "504": jsonError("Reference image request timed out.") },
    },
  },
  "/api/v1/workspaces/{workspaceId}/research-items/{researchItemId}/designer": {
    patch: {
      tags: ["Research"], summary: "Reassign an in-flight research item to a designer", security: [{ cookieAuth: [] }],
      description: "ADMIN only. Allowed from RESEARCHED, ASSIGNED, DESIGN_IN_PROGRESS, DESIGN_REVIEW, CORRECTION_NEEDED, or ISSUE_REPORTED.",
      parameters: workspaceAndResearchParameters, requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["designerId"], properties: { designerId: { type: "string", minLength: 1 } } } } } },
      responses: { "200": jsonSuccess("Designer reassigned successfully.", { type: "object", required: ["researchItem", "assignment"], properties: { researchItem: { type: "object", required: ["id", "status"], properties: { id: { type: "string" }, status: { $ref: "#/components/schemas/ResearchStatus" } } }, assignment: { $ref: "#/components/schemas/AssignmentSummary" } } }), "400": jsonError("Target user is not a workspace designer."), "401": jsonError("Authentication is required."), "403": jsonError("ADMIN role is required."), "404": jsonError("Research item was not found."), "409": jsonError("The item cannot be reassigned in its current state.") },
    },
  },
};
