export type BuildPasswordResetEmailOptions = {
  rawOtp: string;
};

export type BuiltPasswordResetEmail = {
  subject: string;
  text: string;
  html: string;
};

const escapeHtmlText = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const buildPasswordResetEmail = ({
  rawOtp,
}: BuildPasswordResetEmailOptions): BuiltPasswordResetEmail => {
  const safeOtp = escapeHtmlText(rawOtp);
  const subject = "Your StoreOps verification code";

  const text = `StoreOps — Reset your password

We received a request to reset the password for your StoreOps account.

Your 6-digit verification code is:
${safeOtp}

This code expires in 10 minutes.

If you didn't request this, you can safely ignore this email. Your password will not change.`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your StoreOps password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #18181b; max-width: 560px; margin: 0 auto; padding: 32px 20px; background-color: #fafafa;">
  <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 36px 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
    <div style="margin-bottom: 24px;">
      <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #71717a;">StoreOps</span>
      <h1 style="font-size: 22px; font-weight: 700; color: #09090b; margin: 8px 0 0 0; letter-spacing: -0.02em;">Reset your password</h1>
    </div>

    <p style="font-size: 15px; color: #3f3f46; margin: 0 0 24px 0;">
      We received a request to reset the password for your StoreOps account. Enter the following verification code to continue:
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <div style="display: inline-block; background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 14px 28px; letter-spacing: 8px; font-size: 32px; font-weight: 800; color: #09090b; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
        ${safeOtp}
      </div>
    </div>

    <p style="font-size: 13px; color: #71717a; margin: 20px 0 0 0; text-align: center;">
      This code expires in <strong>10 minutes</strong>.
    </p>

    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 20px 0;" />

    <p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
      If you didn't request this password reset, you can safely ignore this email. Your password will not change and no further action is required.
    </p>
  </div>
</body>
</html>`;

  return {
    subject,
    text,
    html,
  };
};
