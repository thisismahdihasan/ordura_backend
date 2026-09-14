import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../shared/ApiError.js";
import {
  ALLOWED_AVATAR_IMAGE_MIMETYPES,
  AllowedAvatarImageMimeType,
  MAX_AVATAR_IMAGE_SIZE_BYTES,
} from "./auth.storage.js";

// Memory storage engine ensures avatar images are never written to local disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_AVATAR_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const normalizedMime = file.mimetype?.trim().toLowerCase();
    if (
      !ALLOWED_AVATAR_IMAGE_MIMETYPES.includes(
        normalizedMime as AllowedAvatarImageMimeType
      )
    ) {
      return cb(
        new ApiError(
          400,
          "Unsupported image type. Allowed types: image/jpeg, image/png, image/webp"
        )
      );
    }
    cb(null, true);
  },
}).single("avatar");

// Handles optional single avatar multipart upload with memory buffering and error mapping
export const avatarUploadMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  upload(req, _res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new ApiError(400, "Avatar image size exceeds maximum limit of 5MB")
          );
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new ApiError(
              400,
              "Unexpected field or multiple files. Only a single file on 'avatar' is allowed."
            )
          );
        }
        return next(new ApiError(400, `Upload error: ${err.message}`));
      }
      if (err instanceof ApiError) {
        return next(err);
      }
      return next(new ApiError(400, "Invalid file upload"));
    }

    next();
  });
};
