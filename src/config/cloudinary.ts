import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";
import { ApiError } from "../shared/ApiError.js";

// Returns true only when all three Cloudinary credentials are fully provided and non-empty.
export const isCloudinaryConfigured = (): boolean => {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET
  );
};

// Configure Cloudinary once at module initialization if credentials exist.
if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Returns the configured Cloudinary v2 client, or throws a controlled server error if not configured.
export const getCloudinaryClient = () => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      500,
      "Cloudinary is not configured. Missing required credentials."
    );
  }
  return cloudinary;
};
