import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { ApiError } from "../../shared/ApiError.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;
const VERSION_PREFIX = "v1";
const HEX_REGEX = /^[0-9a-fA-F]+$/;

// Retrieves and defensively validates the 32-byte encryption key from environment configuration.
const getEncryptionKey = (): Buffer => {
  const keyHex = env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.trim().length === 0) {
    throw new ApiError(500, "Google Drive token encryption key is not configured");
  }

  const trimmedKeyHex = keyHex.trim();
  if (trimmedKeyHex.length !== 64 || !HEX_REGEX.test(trimmedKeyHex)) {
    throw new ApiError(
      500,
      "Invalid Google Drive token encryption key: must be exactly 64 hexadecimal characters"
    );
  }

  const keyBuffer = Buffer.from(trimmedKeyHex, "hex");
  if (keyBuffer.length !== KEY_LENGTH_BYTES) {
    throw new ApiError(
      500,
      "Invalid Google Drive token encryption key length: expected 32 bytes"
    );
  }

  return keyBuffer;
};

// Encrypts a Google refresh token using authenticated AES-256-GCM and a unique random 12-byte IV.
export const encryptGoogleRefreshToken = (token: string): string => {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new ApiError(400, "Token to encrypt cannot be empty");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
};

// Decrypts and authenticates a versioned serialized token string produced by encryptGoogleRefreshToken.
export const decryptGoogleRefreshToken = (encryptedValue: string): string => {
  if (!encryptedValue || typeof encryptedValue !== "string") {
    throw new ApiError(500, "Invalid encrypted token value");
  }

  const parts = encryptedValue.split(":");
  if (parts.length !== 4) {
    throw new ApiError(500, "Malformed encrypted token format: expected 4 segments");
  }

  const [version, ivHex, authTagHex, ciphertextHex] = parts;

  if (version !== VERSION_PREFIX) {
    throw new ApiError(
      500,
      `Unsupported encrypted token version: expected ${VERSION_PREFIX}`
    );
  }

  if (
    !ivHex ||
    !authTagHex ||
    !ciphertextHex ||
    !HEX_REGEX.test(ivHex) ||
    !HEX_REGEX.test(authTagHex) ||
    !HEX_REGEX.test(ciphertextHex)
  ) {
    throw new ApiError(500, "Malformed encrypted token: non-hexadecimal components");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new ApiError(
      500,
      `Invalid initialization vector length: expected ${IV_LENGTH_BYTES} bytes`
    );
  }

  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new ApiError(
      500,
      `Invalid authentication tag length: expected ${AUTH_TAG_LENGTH_BYTES} bytes`
    );
  }

  if (ciphertext.length === 0) {
    throw new ApiError(500, "Invalid empty ciphertext in encrypted token");
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return plaintext;
  } catch {
    throw new ApiError(
      500,
      "Failed to decrypt token: authentication tag verification failed or ciphertext is corrupted"
    );
  }
};
