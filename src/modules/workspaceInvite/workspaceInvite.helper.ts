import crypto from "node:crypto";

export const generateInviteToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashInviteToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};
