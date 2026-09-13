import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../shared/ApiError.js";
import {
  ALLOWED_REFERENCE_IMAGE_MIMETYPES,
  AllowedReferenceImageMimeType,
  MAX_REFERENCE_IMAGE_SIZE_BYTES,
} from "./research.storage.js";

// Memory storage engine ensures reference images are never written to local disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_REFERENCE_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const normalizedMime = file.mimetype?.trim().toLowerCase();
    if (
      !ALLOWED_REFERENCE_IMAGE_MIMETYPES.includes(
        normalizedMime as AllowedReferenceImageMimeType
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

// Handles single reference image multipart upload with strict memory buffering and error mapping
export const referenceImageUploadMiddleware = (
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
      return next(new ApiError(400, "Image file is required on 'image' field"));
    }

    next();
  });
};

// Handles optional reference image upload for research item creation.
// Passes through cleanly if no file is uploaded, allowing JSON bodies or multipart without file.
export const optionalReferenceImageUploadMiddleware = (
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

    next();
  });
};
