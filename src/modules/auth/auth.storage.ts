import { Readable } from "node:stream";
import { getCloudinaryClient } from "../../config/cloudinary.js";
import { ApiError } from "../../shared/ApiError.js";

// Cloudinary folder destination for user avatar uploads
export const CLOUDINARY_AVATAR_FOLDER = "storeops/avatars";

// Allowed MIME types strictly validated before storage
export const ALLOWED_AVATAR_IMAGE_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedAvatarImageMimeType =
  (typeof ALLOWED_AVATAR_IMAGE_MIMETYPES)[number];

// Maximum allowed image file size for avatars (5 MB)
export const MAX_AVATAR_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type AvatarUploadInput = {
  buffer: Buffer;
  mimetype: string;
};

export type AvatarUploadResult = {
  publicId: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
};

export type AvatarUploader = (
  input: AvatarUploadInput
) => Promise<AvatarUploadResult>;

export type AvatarDestroyer = (publicId: string) => Promise<void>;

// Confirms that the declared avatar MIME type matches its recognizable binary signature.
export const hasValidAvatarImageSignature = (
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

// Uploads a user avatar image buffer to Cloudinary using a stream.
export const uploadAvatarToCloudinary = async (
  input: AvatarUploadInput,
  uploader?: AvatarUploader
): Promise<AvatarUploadResult> => {
  if (!input.buffer || input.buffer.length === 0) {
    throw new ApiError(400, "Avatar image buffer cannot be empty");
  }

  if (input.buffer.length > MAX_AVATAR_IMAGE_SIZE_BYTES) {
    throw new ApiError(400, "Avatar image size exceeds maximum limit of 5MB");
  }

  const normalizedMime = input.mimetype?.trim().toLowerCase();
  if (
    !ALLOWED_AVATAR_IMAGE_MIMETYPES.includes(
      normalizedMime as AllowedAvatarImageMimeType
    )
  ) {
    throw new ApiError(
      400,
      "Unsupported image type. Allowed types: image/jpeg, image/png, image/webp"
    );
  }

  if (!hasValidAvatarImageSignature(input.buffer, normalizedMime)) {
    throw new ApiError(400, "Invalid avatar image file binary signature");
  }

  if (uploader) {
    return await uploader(input);
  }

  let client: ReturnType<typeof getCloudinaryClient>;
  try {
    client = getCloudinaryClient();
  } catch {
    throw new ApiError(500, "Failed to upload avatar image to storage");
  }

  return new Promise<AvatarUploadResult>((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder: CLOUDINARY_AVATAR_FOLDER,
        resource_type: "image",
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            new ApiError(500, "Failed to upload avatar image to storage")
          );
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

// Removes an avatar image from Cloudinary by public ID.
export const destroyAvatarFromCloudinary = async (
  publicId: string,
  destroyer?: AvatarDestroyer
): Promise<void> => {
  const trimmedPublicId = publicId?.trim();
  if (!trimmedPublicId) {
    return;
  }

  if (destroyer) {
    return await destroyer(trimmedPublicId);
  }

  const client = getCloudinaryClient();

  try {
    await client.uploader.destroy(trimmedPublicId, {
      resource_type: "image",
    });
  } catch {
    // Non-blocking cleanup failure: logged internally without failing the primary workflow
  }
};
