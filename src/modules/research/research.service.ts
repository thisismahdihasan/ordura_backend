import { Prisma, ResearchStatus, WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { extractEtsyListing } from "./research.helper.js";
import { fetchEtsyMetadata } from "./research.metadata.js";
import { findLeastWorkloadDesigner } from "./research.assignment.js";
import {
  CreateResearchItemInput,
  GetResearchItemsQueryInput,
  PreviewResearchItemInput,
  UpdateResearchItemBodyInput,
} from "./research.validation.js";
import {
  DuplicateResearchItemData,
  EtsyMetadata,
  ReassignedResearchItemData,
  ResearchItemListResult,
  SafeResearchItem,
  ResearchItemDetailResult,
  ResearchPreviewResult,
  ManualReferenceImageUploadResult,
  DeleteResearchItemResult,
} from "./research.type.js";
import {
  destroyReferenceImageFromCloudinary,
  uploadReferenceImageToCloudinary,
  ReferenceImageUploader,
  ReferenceImageDestroyer,
} from "./research.storage.js";
import { NOTIFICATION_TYPE_DESIGN_ASSIGNED } from "../notification/notification.type.js";

export const safeResearchItemSelect = {
  id: true,
  workspaceId: true,
  etsyListingId: true,
  originalUrl: true,
  normalizedUrl: true,
  title: true,
  referenceImageUrl: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

const duplicateResearchItemSelect = {
  id: true,
  status: true,
  createdAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export type CreateResearchItemOptions = {
  metadataFetcher?: (url: string) => Promise<EtsyMetadata>;
};

// Creates a new research item, parses metadata, and atomically auto-assigns the least-loaded designer.
export const createResearchItem = async (
  workspaceId: string,
  userId: string,
  input: CreateResearchItemInput,
  options?: CreateResearchItemOptions
): Promise<SafeResearchItem> => {
  const { originalUrl, normalizedUrl, etsyListingId } = extractEtsyListing(
    input.etsyUrl
  );

  // 1. Readable duplicate pre-check within the same workspace
  const existingItem = await prisma.researchItem.findUnique({
    where: {
      workspaceId_etsyListingId: {
        workspaceId,
        etsyListingId,
      },
    },
    select: duplicateResearchItemSelect,
  });

  if (existingItem) {
    const duplicateData: DuplicateResearchItemData = {
      alreadyExists: true,
      researchItemId: existingItem.id,
      createdBy: existingItem.createdBy,
      currentStatus: existingItem.status,
      createdAt: existingItem.createdAt,
    };

    throw new ApiError(
      409,
      "This Etsy listing has already been added to this workspace",
      true,
      "",
      duplicateData
    );
  }

  // 2. Best-effort metadata fetch only for NEW items
  let metadata: EtsyMetadata = { title: null, referenceImageUrl: null };
  try {
    const metadataFetcher = options?.metadataFetcher ?? fetchEtsyMetadata;
    metadata = await metadataFetcher(normalizedUrl);
  } catch {
    metadata = { title: null, referenceImageUrl: null };
  }

  // 3. Atomically create ResearchItem and auto-assign eligible designer if available
  try {
    const createdItem = await prisma.$transaction(async (tx) => {
      const chosenDesignerId = await findLeastWorkloadDesigner(
        tx,
        workspaceId
      );

      const initialStatus = chosenDesignerId
        ? ResearchStatus.ASSIGNED
        : ResearchStatus.RESEARCHED;

      const item = await tx.researchItem.create({
        data: {
          workspaceId,
          etsyListingId,
          originalUrl,
          normalizedUrl,
          title: metadata.title,
          referenceImageUrl: metadata.referenceImageUrl,
          createdById: userId,
          status: initialStatus,
        },
        select: safeResearchItemSelect,
      });

      if (chosenDesignerId) {
        await tx.designAssignment.create({
          data: {
            researchItemId: item.id,
            designerId: chosenDesignerId,
            isCurrent: true,
          },
          select: { id: true },
        });
        await tx.notification.create({
          data: { userId: chosenDesignerId, type: NOTIFICATION_TYPE_DESIGN_ASSIGNED, title: "Design Assigned", message: "You have been assigned a new design.", researchItemId: item.id },
        });
      }

      return item;
    },
    {
      maxWait: 10000,
      timeout: 15000,
    });

    return createdItem;
  } catch (error) {
    // Catch concurrent duplicate creation race condition (P2002)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrentItem = await prisma.researchItem.findUnique({
        where: {
          workspaceId_etsyListingId: {
            workspaceId,
            etsyListingId,
          },
        },
        select: duplicateResearchItemSelect,
      });

      const duplicateData: DuplicateResearchItemData = {
        alreadyExists: true,
        researchItemId: concurrentItem?.id ?? "",
        createdBy: concurrentItem?.createdBy ?? {
          id: "",
          name: "",
          email: "",
        },
        currentStatus: concurrentItem?.status ?? ResearchStatus.RESEARCHED,
        createdAt: concurrentItem?.createdAt ?? new Date(),
      };

      throw new ApiError(
        409,
        "This Etsy listing has already been added to this workspace",
        true,
        "",
        duplicateData
      );
    }

    throw error;
  }
};

export const safeResearchItemListSelect = Prisma.validator<Prisma.ResearchItemSelect>()({
  id: true,
  workspaceId: true,
  etsyListingId: true,
  originalUrl: true,
  normalizedUrl: true,
  title: true,
  referenceImageUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  designAssignments: {
    where: { isCurrent: true },
    orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      id: true,
      designerId: true,
      assignedAt: true,
      startedAt: true,
      completedAt: true,
      isCurrent: true,
      designer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  issueReports: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      id: true,
      reason: true,
      details: true,
      createdAt: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
});

const safeResearchItemDetailSelect = {
  id: true,
  workspaceId: true,
  etsyListingId: true,
  originalUrl: true,
  normalizedUrl: true,
  title: true,
  referenceImageUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  designAssignments: {
    where: { isCurrent: true },
    take: 1,
    select: {
      id: true,
      designerId: true,
      assignedAt: true,
      startedAt: true,
      completedAt: true,
      isCurrent: true,
      designer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  reviewSubmissions: {
    orderBy: { roundNumber: "desc" },
    take: 1,
    select: {
      id: true,
      roundNumber: true,
      imageUrl: true,
      imageDeletedAt: true,
      note: true,
      submittedAt: true,
      approvedAt: true,
      approvedById: true,
    },
  },
} as const;

// Returns a paginated list of workspace research items matching creator, status, date, or search filters.
export const getResearchItems = async (
  workspaceId: string,
  query: GetResearchItemsQueryInput
): Promise<ResearchItemListResult> => {
  const { page, limit, createdBy, status, date, search } = query;

  const where: Prisma.ResearchItemWhereInput = {
    workspaceId,
  };

  if (createdBy) {
    where.createdById = createdBy;
  }

  if (status) {
    where.status = status;
  }

  if (date) {
    const [year, month, day] = date.split("-").map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
    where.createdAt = {
      gte: startOfDay,
      lt: nextDay,
    };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { etsyListingId: { contains: search, mode: "insensitive" } },
      { normalizedUrl: { contains: search, mode: "insensitive" } },
      { originalUrl: { contains: search, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [rawItems, total] = await prisma.$transaction([
    prisma.researchItem.findMany({
      where,
      select: safeResearchItemListSelect,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.researchItem.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  const items = rawItems.map((item) => {
    const currentAssignment = item.designAssignments[0] ?? null;
    const latestIssueReport = item.issueReports[0] ?? null;

    return {
      id: item.id,
      workspaceId: item.workspaceId,
      etsyListingId: item.etsyListingId,
      originalUrl: item.originalUrl,
      normalizedUrl: item.normalizedUrl,
      title: item.title,
      referenceImageUrl: item.referenceImageUrl,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy,
      currentDesigner: currentAssignment?.designer ?? null,
      currentDesignAssignment: currentAssignment
        ? {
            id: currentAssignment.id,
            designerId: currentAssignment.designerId,
            assignedAt: currentAssignment.assignedAt,
            startedAt: currentAssignment.startedAt,
            completedAt: currentAssignment.completedAt,
            isCurrent: currentAssignment.isCurrent,
          }
        : null,
      latestIssueReport,
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

// Fetches details for a single research item scoped strictly to the specified workspace.
export const getResearchItemById = async (
  workspaceId: string,
  researchItemId: string
): Promise<ResearchItemDetailResult> => {
  const researchItem = await prisma.researchItem.findFirst({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: safeResearchItemDetailSelect,
  });

  if (!researchItem) {
    throw new ApiError(404, "Research item not found");
  }

  const currentAssignment = researchItem.designAssignments[0] ?? null;
  const rawLatestReview = researchItem.reviewSubmissions[0] ?? null;
  const latestReview = rawLatestReview
    ? {
        ...rawLatestReview,
        imageUrl:
          rawLatestReview.imageDeletedAt === null
            ? rawLatestReview.imageUrl
            : null,
      }
    : null;

  return {
    id: researchItem.id,
    workspaceId: researchItem.workspaceId,
    etsyListingId: researchItem.etsyListingId,
    originalUrl: researchItem.originalUrl,
    normalizedUrl: researchItem.normalizedUrl,
    title: researchItem.title,
    referenceImageUrl: researchItem.referenceImageUrl,
    status: researchItem.status,
    createdAt: researchItem.createdAt,
    updatedAt: researchItem.updatedAt,
    createdBy: researchItem.createdBy,
    currentDesigner: currentAssignment?.designer ?? null,
    currentDesignAssignment: currentAssignment
      ? {
          id: currentAssignment.id,
          designerId: currentAssignment.designerId,
          assignedAt: currentAssignment.assignedAt,
          startedAt: currentAssignment.startedAt,
          completedAt: currentAssignment.completedAt,
          isCurrent: currentAssignment.isCurrent,
        }
      : null,
    latestReview,
  };
};

// Retrieves the stored reference image URL for an item after verifying workspace access.
export const getReferenceImageData = async (
  workspaceId: string,
  researchItemId: string
): Promise<{ id: string; referenceImageUrl: string }> => {
  const item = await prisma.researchItem.findFirst({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: {
      id: true,
      referenceImageUrl: true,
    },
  });

  if (!item) {
    throw new ApiError(404, "Research item not found");
  }

  if (!item.referenceImageUrl || item.referenceImageUrl.trim() === "") {
    throw new ApiError(404, "Reference image not available");
  }

  return {
    id: item.id,
    referenceImageUrl: item.referenceImageUrl.trim(),
  };
};

// Preserves research-management access while requiring designer-only users to own the current assignment.
export const getAuthorizedReferenceImageData = async (
  workspaceId: string,
  researchItemId: string,
  userId: string,
  roles: readonly WorkspaceRole[]
): Promise<{ id: string; referenceImageUrl: string }> => {
  const item = await prisma.researchItem.findFirst({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: {
      id: true,
      referenceImageUrl: true,
      designAssignments: {
        where: { isCurrent: true },
        orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          designerId: true,
        },
      },
    },
  });

  if (!item) {
    throw new ApiError(404, "Research item not found");
  }

  const hasResearchManagementRole =
    roles.includes(WorkspaceRole.ADMIN) ||
    roles.includes(WorkspaceRole.RESEARCHER);
  const isDesignerOnly =
    roles.includes(WorkspaceRole.DESIGNER) &&
    !hasResearchManagementRole &&
    !roles.includes(WorkspaceRole.LISTER);

  if (isDesignerOnly && item.designAssignments[0]?.designerId !== userId) {
    throw new ApiError(403, "You are not assigned to this research item");
  }

  if (!item.referenceImageUrl || item.referenceImageUrl.trim() === "") {
    throw new ApiError(404, "Reference image not available");
  }

  return {
    id: item.id,
    referenceImageUrl: item.referenceImageUrl.trim(),
  };
};

export const REASSIGNABLE_STATUSES: ResearchStatus[] = [
  ResearchStatus.RESEARCHED,
  ResearchStatus.ASSIGNED,
  ResearchStatus.DESIGN_IN_PROGRESS,
  ResearchStatus.DESIGN_REVIEW,
  ResearchStatus.CORRECTION_NEEDED,
  ResearchStatus.ISSUE_REPORTED,
];

// Atomically reassigns an in-flight research item to another workspace designer, preserving assignment history.
export const reassignResearchDesigner = async (
  workspaceId: string,
  researchItemId: string,
  designerId: string
): Promise<ReassignedResearchItemData> => {
  return await prisma.$transaction(async (tx) => {
    // 1. Serialize/lock row and verify item existence within workspace
    let lockedItem;
    try {
      lockedItem = await tx.researchItem.update({
        where: {
          id: researchItemId,
          workspaceId,
        },
        data: { updatedAt: new Date() },
        select: { id: true, status: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new ApiError(404, "Research item not found");
      }
      throw error;
    }

    // 2. Status eligibility check on fresh/locked state
    if (!REASSIGNABLE_STATUSES.includes(lockedItem.status)) {
      throw new ApiError(409, "Research item can no longer be reassigned");
    }

    // 4. Validate target designer in same workspace
    const targetMember = await tx.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: designerId,
        },
      },
      select: {
        userId: true,
        roles: true,
      },
    });

    if (!targetMember || !targetMember.roles.includes(WorkspaceRole.DESIGNER)) {
      throw new ApiError(
        400,
        "Selected user is not a designer in this workspace"
      );
    }

    // 5. Inspect current assignment
    const currentAssignment = await tx.designAssignment.findFirst({
      where: {
        researchItemId,
        isCurrent: true,
      },
      select: {
        id: true,
        designerId: true,
      },
    });

    // 6. Same designer conflict check
    if (currentAssignment && currentAssignment.designerId === designerId) {
      throw new ApiError(
        409,
        "Research item is already assigned to this designer"
      );
    }

    // 7. Mark existing current assignment historical
    if (currentAssignment) {
      await tx.designAssignment.updateMany({
        where: {
          researchItemId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });
    }

    // 8. Create new current assignment
    const newAssignment = await tx.designAssignment.create({
      data: {
        researchItemId,
        designerId,
        isCurrent: true,
      },
      select: {
        id: true,
        designerId: true,
        assignedAt: true,
        isCurrent: true,
      },
    });
    await tx.notification.create({
      data: { userId: designerId, type: NOTIFICATION_TYPE_DESIGN_ASSIGNED, title: "Design Assigned", message: "You have been assigned a new design.", researchItemId },
    });

    // 9. Status transition logic
    let finalStatus = lockedItem.status;
    if (
      lockedItem.status === ResearchStatus.RESEARCHED ||
      lockedItem.status === ResearchStatus.ISSUE_REPORTED
    ) {
      await tx.researchItem.update({
        where: {
          id: researchItemId,
          workspaceId,
        },
        data: { status: ResearchStatus.ASSIGNED },
      });
      finalStatus = ResearchStatus.ASSIGNED;
    }

    return {
      researchItem: {
        id: lockedItem.id,
        status: finalStatus,
      },
      assignment: newAssignment,
    };
  },
  {
    maxWait: 10000,
    timeout: 15000,
  });
};

// Previews Etsy listing metadata and checks same-workspace duplicates without persistent mutations.
export const previewResearchItem = async (
  workspaceId: string,
  input: PreviewResearchItemInput,
  options?: CreateResearchItemOptions
): Promise<ResearchPreviewResult> => {
  const { normalizedUrl, etsyListingId } = extractEtsyListing(input.etsyUrl);

  const existingItem = await prisma.researchItem.findUnique({
    where: {
      workspaceId_etsyListingId: {
        workspaceId,
        etsyListingId,
      },
    },
    select: duplicateResearchItemSelect,
  });

  let metadata: EtsyMetadata = { title: null, referenceImageUrl: null };
  try {
    const metadataFetcher = options?.metadataFetcher ?? fetchEtsyMetadata;
    metadata = await metadataFetcher(normalizedUrl);
  } catch {
    metadata = { title: null, referenceImageUrl: null };
  }

  if (existingItem) {
    return {
      etsyListingId,
      normalizedUrl,
      title: metadata.title,
      referenceImageUrl: metadata.referenceImageUrl,
      alreadyExists: true,
      duplicate: {
        researchItemId: existingItem.id,
        createdBy: existingItem.createdBy,
        currentStatus: existingItem.status,
        createdAt: existingItem.createdAt,
      },
    };
  }

  return {
    etsyListingId,
    normalizedUrl,
    title: metadata.title,
    referenceImageUrl: metadata.referenceImageUrl,
    alreadyExists: false,
    duplicate: null,
  };
};

export type UploadReferenceImageOptions = {
  uploader?: ReferenceImageUploader;
  destroyer?: ReferenceImageDestroyer;
};

// Manually uploads and updates the reference image for a research item in Cloudinary.
export const uploadResearchReferenceImage = async (
  workspaceId: string,
  researchItemId: string,
  file: { buffer: Buffer; mimetype: string },
  options?: UploadReferenceImageOptions
): Promise<ManualReferenceImageUploadResult> => {
  const existingItem = await prisma.researchItem.findUnique({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: {
      id: true,
      referenceImagePublicId: true,
    },
  });

  if (!existingItem) {
    throw new ApiError(404, "Research item not found");
  }

  const uploader = options?.uploader ?? uploadReferenceImageToCloudinary;
  const uploadResult = await uploader({
    buffer: file.buffer,
    mimetype: file.mimetype,
  });

  try {
    await prisma.researchItem.update({
      where: {
        id: researchItemId,
        workspaceId,
      },
      data: {
        referenceImageUrl: uploadResult.secureUrl,
        referenceImagePublicId: uploadResult.publicId,
      },
    });
  } catch (dbError) {
    const destroyer =
      options?.destroyer ?? destroyReferenceImageFromCloudinary;
    await destroyer(uploadResult.publicId);
    throw dbError;
  }

  if (
    existingItem.referenceImagePublicId &&
    existingItem.referenceImagePublicId !== uploadResult.publicId
  ) {
    const destroyer =
      options?.destroyer ?? destroyReferenceImageFromCloudinary;
    await destroyer(existingItem.referenceImagePublicId);
  }

  return {
    researchItemId: existingItem.id,
    referenceImageUrl: uploadResult.secureUrl,
  };
};

// Updates editable metadata (title) for a research item.
export const updateResearchItem = async (
  workspaceId: string,
  researchItemId: string,
  input: UpdateResearchItemBodyInput
): Promise<SafeResearchItem> => {
  const existingItem = await prisma.researchItem.findUnique({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!existingItem) {
    throw new ApiError(404, "Research item not found");
  }

  const updatedItem = await prisma.researchItem.update({
    where: {
      id: researchItemId,
      workspaceId,
    },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
    },
    select: safeResearchItemSelect,
  });

  return updatedItem;
};

export type DeleteResearchItemOptions = {
  destroyer?: ReferenceImageDestroyer;
};

// Production-safe deletion of early-stage research items with no substantive downstream workflow.
export const deleteResearchItem = async (
  workspaceId: string,
  researchItemId: string,
  options?: DeleteResearchItemOptions
): Promise<DeleteResearchItemResult> => {
  const item = await prisma.researchItem.findUnique({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: {
      id: true,
      status: true,
      referenceImagePublicId: true,
      designAssignments: {
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
        },
      },
      reviewSubmissions: {
        select: { id: true },
        take: 1,
      },
      issueReports: {
        select: { id: true },
        take: 1,
      },
      finalAssets: {
        select: { id: true },
        take: 1,
      },
      listingAssignments: {
        select: { id: true },
        take: 1,
      },
      listingResult: {
        select: { id: true },
      },
    },
  });

  if (!item) {
    throw new ApiError(404, "Research item not found");
  }

  const ALLOWED_DELETE_STATUSES: ResearchStatus[] = [
    ResearchStatus.RESEARCHED,
    ResearchStatus.ASSIGNED,
  ];

  if (!ALLOWED_DELETE_STATUSES.includes(item.status)) {
    throw new ApiError(
      409,
      `Cannot delete research item in '${item.status}' status. Only items in RESEARCHED or ASSIGNED status may be deleted.`
    );
  }

  const hasStartedAssignment = item.designAssignments.some(
    (a) => a.startedAt !== null || a.completedAt !== null
  );
  const hasSubstantiveRecords =
    hasStartedAssignment ||
    item.reviewSubmissions.length > 0 ||
    item.issueReports.length > 0 ||
    item.finalAssets.length > 0 ||
    item.listingAssignments.length > 0 ||
    item.listingResult !== null;

  if (hasSubstantiveRecords) {
    throw new ApiError(
      409,
      "Cannot delete research item with active or completed production workflow history"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: { researchItemId },
    });

    await tx.designAssignment.deleteMany({
      where: { researchItemId },
    });

    await tx.researchItem.delete({
      where: {
        id: researchItemId,
        workspaceId,
      },
    });
  });

  if (item.referenceImagePublicId) {
    const destroyer =
      options?.destroyer ?? destroyReferenceImageFromCloudinary;
    await destroyer(item.referenceImagePublicId);
  }

  return {
    researchItemId: item.id,
  };
};
