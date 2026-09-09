import { Readable } from "node:stream";
import { getCloudinaryClient } from "../../config/cloudinary.js";
import { ApiError } from "../../shared/ApiError.js";

// Cloudinary folder destination for temporary review screenshot uploads
export const CLOUDINARY_REVIEW_FOLDER = "ordura/review-submissions";

// Allowed MIME types strictly validated before storage
export const ALLOWED_REVIEW_IMAGE_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedReviewImageMimeType =
  (typeof ALLOWED_REVIEW_IMAGE_MIMETYPES)[number];

// Maximum allowed image file size for review screenshots (10 MB)
export const MAX_REVIEW_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export type ReviewImageUploadInput = {
  buffer: Buffer;
  mimetype: string;
};

export type ReviewImageUploadResult = {
  publicId: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
};

export type ReviewImageUploader = (
  input: ReviewImageUploadInput
) => Promise<ReviewImageUploadResult>;

export type ReviewImageDestroyer = (publicId: string) => Promise<void>;

// Confirms that the declared review-image MIME type matches its recognizable binary signature.
export const hasValidReviewImageSignature = (
  buffer: Buffer | undefined,
  mimetype: string
): boolean => {
  if (!buffer || buffer.length === 0) {
    return false;
  }

  const normalizedMime = mimetype.trim().toLowerCase();

  if (normalizedMime === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (normalizedMime === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (normalizedMime === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
};

// Uploads a temporary review screenshot buffer to Cloudinary using a stream.
export const uploadTemporaryReviewImage = async (
  input: ReviewImageUploadInput,
  uploader?: ReviewImageUploader
): Promise<ReviewImageUploadResult> => {
  // 1. Reject empty buffer
  if (!input.buffer || input.buffer.length === 0) {
    throw new ApiError(400, "Image buffer cannot be empty");
  }

  // 2. Reject oversized image (> 10 MB)
  if (input.buffer.length > MAX_REVIEW_IMAGE_SIZE_BYTES) {
    throw new ApiError(400, "Image size exceeds maximum limit of 10MB");
  }

  // 3. Reject unsupported MIME type (MIME-based, not extension-based)
  const normalizedMime = input.mimetype?.trim().toLowerCase();
  if (
    !ALLOWED_REVIEW_IMAGE_MIMETYPES.includes(
      normalizedMime as AllowedReviewImageMimeType
    )
  ) {
    throw new ApiError(
      400,
      "Unsupported image type. Allowed types: image/jpeg, image/png, image/webp"
    );
  }

  // 4. Reject files whose binary signature does not match their declared MIME type.
  if (!hasValidReviewImageSignature(input.buffer, normalizedMime)) {
    throw new ApiError(400, "Invalid review image file.");
  }

  // 5. Delegate to injected uploader for deterministic unit testing if provided
  if (uploader) {
    return await uploader(input);
  }

  // 6. Stream buffer directly to Cloudinary upload_stream
  const client = getCloudinaryClient();

  return new Promise<ReviewImageUploadResult>((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder: CLOUDINARY_REVIEW_FOLDER,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          return reject(new ApiError(500, "Failed to upload review image"));
        }

        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        });
      }
    );

    Readable.from(input.buffer).pipe(uploadStream);
  });
};

// Removes a temporary review screenshot from Cloudinary by public ID.
export const deleteTemporaryReviewImage = async (
  publicId: string,
  destroyer?: ReviewImageDestroyer
): Promise<void> => {
  // 1. Reject empty or whitespace-only publicId
  const trimmedPublicId = publicId?.trim();
  if (!trimmedPublicId) {
    throw new ApiError(400, "Image publicId must be a non-empty string");
  }

  // 2. Delegate to injected destroyer for deterministic unit testing if provided
  if (destroyer) {
    return await destroyer(trimmedPublicId);
  }

  // 3. Cloudinary deletion
  const client = getCloudinaryClient();

  try {
    const result = await client.uploader.destroy(trimmedPublicId, {
      resource_type: "image",
    });

    if (result.result !== "ok") {
      throw new ApiError(500, "Failed to delete temporary review image");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "Failed to delete temporary review image");
  }
};
