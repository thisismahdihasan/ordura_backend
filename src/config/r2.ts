import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

// Creates the server-only S3-compatible client used for Ordura's private R2 bucket.
export const r2Client = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export default r2Client;
