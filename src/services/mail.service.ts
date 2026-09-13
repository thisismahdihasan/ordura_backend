import { Resend } from "resend";
import { env } from "../config/env.js";

export type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type MailSendResult = {
  messageId: string;
};

export type MailSender = (options: SendMailOptions) => Promise<MailSendResult>;

export type MailProviderErrorDetails = {
  code: string | null;
  message: string;
  statusCode: number | null;
};

type UnknownRecord = Record<string, unknown>;

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const safeMailProviderText = (value: string): string =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, 500);

const readSafeString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0
    ? safeMailProviderText(value)
    : null;

const readSafeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const getMailProviderErrorDetails = (
  error: unknown
): MailProviderErrorDetails => {
  const details = isUnknownRecord(error) ? error : {};

  return {
    code: readSafeString(details.code) ?? readSafeString(details.name),
    message:
      error instanceof Error
        ? safeMailProviderText(error.message)
        : readSafeString(details.message) ?? "Unknown mail provider error",
    statusCode:
      readSafeNumber(details.statusCode) ??
      readSafeNumber(details.status),
  };
};

const resend = new Resend(env.RESEND_API_KEY);

const sendWithResend: MailSender = async (options) => {
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [options.to],
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error("Mail provider did not return a message ID");
  }

  return {
    messageId: data.id,
  };
};

let activeMailSender: MailSender = sendWithResend;

// Dispatches an email via Resend or a mock test sender.
export const sendMail = async (
  options: SendMailOptions
): Promise<MailSendResult> => {
  return activeMailSender(options);
};

// Overrides the active email sender with a custom mock function during tests.
export const setMailSenderForTesting = (customSender: MailSender): void => {
  activeMailSender = customSender;
};

// Restores the default Resend sender after test overrides.
export const resetMailSender = (): void => {
  activeMailSender = sendWithResend;
};

