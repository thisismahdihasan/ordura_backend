import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type MailSendEvidence = {
  accepted: string[];
  messageId: string;
  rejected: string[];
  response: string;
};

export type MailSender = (options: SendMailOptions) => Promise<MailSendEvidence>;

export type MailTransportErrorDetails = {
  code: string | null;
  command: string | null;
  message: string;
  response: string | null;
  responseCode: number | null;
};

type UnknownRecord = Record<string, unknown>;

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const safeSmtpText = (value: string): string =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, 500);

const readSafeString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? safeSmtpText(value) : null;

const readSafeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const getMailTransportErrorDetails = (
  error: unknown
): MailTransportErrorDetails => {
  const details = isUnknownRecord(error) ? error : {};

  return {
    code: readSafeString(details.code),
    command: readSafeString(details.command),
    message: error instanceof Error ? safeSmtpText(error.message) : "Unknown SMTP transport error",
    response: readSafeString(details.response),
    responseCode: readSafeNumber(details.responseCode),
  };
};

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 20_000,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// Verifies the configured SMTP connection and authentication without sending mail.
export const verifyMailTransport = async (): Promise<void> => {
  await transporter.verify();
};

const sendWithTransport: MailSender = async (options) => {
  const result = await transporter.sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  return {
    accepted: result.accepted.map((recipient) => String(recipient)),
    messageId: result.messageId,
    rejected: result.rejected.map((recipient) => String(recipient)),
    response: result.response ?? "",
  };
};

let activeMailSender: MailSender = sendWithTransport;

// Dispatches an email via the configured SMTP transport or mock test sender.
export const sendMail = async (
  options: SendMailOptions
): Promise<MailSendEvidence> => {
  return activeMailSender(options);
};

// Overrides the active email sender with a custom mock function during tests.
export const setMailSenderForTesting = (customSender: MailSender): void => {
  activeMailSender = customSender;
};

// Restores the default SMTP nodemailer sender after test overrides.
export const resetMailSender = (): void => {
  activeMailSender = sendWithTransport;
};

