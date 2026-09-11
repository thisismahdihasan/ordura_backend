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

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

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

