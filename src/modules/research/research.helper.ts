import { ApiError } from "../../shared/ApiError.js";
import { ParsedEtsyListing } from "./research.type.js";

export const extractEtsyListing = (rawUrl: string): ParsedEtsyListing => {
  if (typeof rawUrl !== "string") {
    throw new ApiError(400, "etsyUrl must be a string");
  }

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    throw new ApiError(400, "etsyUrl is required");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new ApiError(400, "Invalid URL format");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ApiError(400, "URL must use http or https protocol");
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isEtsyHost = hostname === "etsy.com" || hostname.endsWith(".etsy.com");
  if (!isEtsyHost) {
    throw new ApiError(400, "Only Etsy listing URLs are supported");
  }

  const match = parsedUrl.pathname.match(/(?:^|\/)listing\/(\d+)(?:\/|$)/i);
  if (!match || !match[1]) {
    throw new ApiError(
      400,
      "Etsy listing URL must contain a valid numeric listing ID"
    );
  }

  const etsyListingId = match[1];
  const normalizedUrl = `https://www.etsy.com/listing/${etsyListingId}`;

  return {
    originalUrl: trimmedUrl,
    normalizedUrl,
    etsyListingId,
  };
};
