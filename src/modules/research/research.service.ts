import { Prisma, ResearchStatus } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { extractEtsyListing } from "./research.helper.js";
import { fetchEtsyMetadata } from "./research.metadata.js";
import { CreateResearchItemInput } from "./research.validation.js";
import {
  DuplicateResearchItemData,
  EtsyMetadata,
  SafeResearchItem,
} from "./research.type.js";

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

  // 3. Create ResearchItem with database concurrency protection
  try {
    const createdItem = await prisma.researchItem.create({
      data: {
        workspaceId,
        etsyListingId,
        originalUrl,
        normalizedUrl,
        title: metadata.title,
        referenceImageUrl: metadata.referenceImageUrl,
        createdById: userId,
        status: ResearchStatus.RESEARCHED,
      },
      select: safeResearchItemSelect,
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
