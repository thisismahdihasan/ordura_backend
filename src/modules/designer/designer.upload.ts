import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../shared/ApiError.js";
import {
  ALLOWED_REVIEW_IMAGE_MIMETYPES,
  AllowedReviewImageMimeType,
  MAX_REVIEW_IMAGE_SIZE_BYTES,
} from "./designer.review-storage.js";

// Memory storage engine ensures review screenshots are never written to local disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_REVIEW_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const normalizedMime = file.mimetype?.trim().toLowerCase();
    if (
      !ALLOWED_REVIEW_IMAGE_MIMETYPES.includes(
        normalizedMime as AllowedReviewImageMimeType
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
}).single("image");

// Handles single image multipart upload with strict memory buffering and error mapping
export const reviewImageUploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  upload(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new ApiError(400, "Image size exceeds maximum limit of 10MB")
          );
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new ApiError(
              400,
              "Unexpected field or multiple files. Only a single file on 'image' is allowed."
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

    if (!req.file) {
      return next(new ApiError(400, "Image file is required"));
    }

    next();
  });
};
