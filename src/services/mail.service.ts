import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type MailSender = (options: SendMailOptions) => Promise<void>;

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

let activeMailSender: MailSender = async (
  options: SendMailOptions
): Promise<void> => {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
};

export const sendMail = async (options: SendMailOptions): Promise<void> => {
  await activeMailSender(options);
};

export const setMailSenderForTesting = (customSender: MailSender): void => {
  activeMailSender = customSender;
};

export const resetMailSender = (): void => {
  activeMailSender = async (options: SendMailOptions): Promise<void> => {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  };
};
