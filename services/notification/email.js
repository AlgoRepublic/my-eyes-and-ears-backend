let nodemailer = null;
let cachedTransporter = null;

const {
  buildOtpEmail,
  buildLovedOneInvitationEmail,
  buildCaregiverInviteEmail,
  APP_NAME,
} = require("./emailTemplates");

const getNodemailer = () => {
  if (!nodemailer) {
    try {
      nodemailer = require("nodemailer");
    } catch (error) {
      throw new Error(
        "nodemailer is not installed. Run: npm install nodemailer",
      );
    }
  }

  return nodemailer;
};

const parseFromAddress = () => {
  const fromEmail =
    process.env.MAILJET_FROM_EMAIL ||
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM;
  const fromName =
    process.env.MAILJET_FROM_NAME || process.env.MAIL_FROM_NAME || APP_NAME;

  if (!fromEmail) {
    throw new Error(
      "Missing sender address. Set MAILJET_FROM_EMAIL, MAIL_FROM, or SMTP_FROM",
    );
  }

  return { fromEmail, fromName };
};

const usesMailjetApi = () =>
  Boolean(process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET);

const getSmtpConfigOrThrow = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure =
    process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465";

  if (!host || !user || !pass) {
    throw new Error(
      "Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS or use MAILJET_API_KEY and MAILJET_API_SECRET",
    );
  }

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  };
};

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const mailer = getNodemailer();
  const smtpConfig = getSmtpConfigOrThrow();

  cachedTransporter = mailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth,
  });

  return cachedTransporter;
};

const sendViaMailjet = async ({ to, subject, text, html }) => {
  const apiKey = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_API_SECRET;
  const { fromEmail, fromName } = parseFromAddress();

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Messages: [
        {
          From: {
            Email: fromEmail,
            Name: fromName,
          },
          To: [
            {
              Email: to,
            },
          ],
          Subject: subject,
          TextPart: text,
          HTMLPart: html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mailjet send failed (${response.status}): ${body}`);
  }

  return response.json();
};

const sendViaSmtp = async ({ to, subject, text, html }) => {
  const { fromEmail, fromName } = parseFromAddress();
  const transporter = getTransporter();

  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text,
    html,
  });
};

const sendEmail = async ({ to, subject, text, html }) => {
  if (!to) {
    throw new Error("Email recipient is required");
  }

  if (usesMailjetApi()) {
    return sendViaMailjet({ to, subject, text, html });
  }

  return sendViaSmtp({ to, subject, text, html });
};

const OTP_EXPIRY_MINUTES_DEFAULT = 10;

const sendSignupOtpEmail = async ({
  to,
  name,
  otp,
  expiresMinutes = OTP_EXPIRY_MINUTES_DEFAULT,
}) => {
  const { text, html } = buildOtpEmail({
    recipientName: name,
    otp,
    expiresMinutes,
    purposeTitle: "Verify your email",
    purposeDescription:
      "Use this code to verify your email address and complete your registration.",
  });

  return sendEmail({
    to,
    subject: `${APP_NAME} — Email verification code`,
    text,
    html,
  });
};

const sendForgotPasswordOtpEmail = async ({
  to,
  name,
  otp,
  expiresMinutes = OTP_EXPIRY_MINUTES_DEFAULT,
}) => {
  const { text, html } = buildOtpEmail({
    recipientName: name,
    otp,
    expiresMinutes,
    purposeTitle: "Reset your password",
    purposeDescription: "Use this code to reset your password.",
  });

  return sendEmail({
    to,
    subject: `${APP_NAME} — Password reset code`,
    text,
    html,
  });
};

const sendLovedOneInvitationEmail = async ({
  to,
  lovedOneName,
  inviterName,
  invitationCode,
}) => {
  const { subject, text, html } = buildLovedOneInvitationEmail({
    lovedOneName,
    inviterName,
    invitationCode,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

const sendCaregiverInviteEmail = async ({
  to,
  caregiverName,
  inviterName,
  familyName,
}) => {
  const { subject, text, html } = buildCaregiverInviteEmail({
    caregiverName,
    inviterName,
    familyName,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

const sendCaregiverCredentialsEmail = async ({
  to,
  caregiverName,
  password,
}) => {
  const safeName = caregiverName || "Caregiver";

  const subject = `Welcome to ${APP_NAME} — Your caregiver account`;

  const text = [
    `Hi ${safeName},`,
    "",
    "Your caregiver account has been successfully created.",
    "",
    `Email: ${to}`,
    `Temporary password: ${password}`,
    "",
    "For your security, please sign in and change your password immediately after your first login.",
    "",
    "If you did not expect this account, please contact your administrator.",
    "",
    "Best regards,",
    `${APP_NAME} Team`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Caregiver Account</title>
</head>

<body style="
  margin: 0;
  padding: 0;
  background-color: #f4f7fb;
  font-family: Arial, Helvetica, sans-serif;
  color: #1f2937;
">

  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="background-color: #f4f7fb; padding: 40px 16px;"
  >
    <tr>
      <td align="center">

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width: 600px;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          "
        >

          <tr>
            <td
              style="
                background-color: #2563eb;
                padding: 32px 40px;
                text-align: center;
              "
            >
              <div
                style="
                  font-size: 26px;
                  font-weight: 700;
                  color: #ffffff;
                  letter-spacing: -0.5px;
                "
              >
                ${APP_NAME}
              </div>

              <div
                style="
                  margin-top: 8px;
                  font-size: 14px;
                  color: #dbeafe;
                "
              >
                Caregiver Portal
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">

              <h1
                style="
                  margin: 0 0 16px;
                  font-size: 26px;
                  line-height: 1.3;
                  color: #111827;
                "
              >
                Welcome, ${safeName}! 👋
              </h1>

              <p
                style="
                  margin: 0 0 24px;
                  font-size: 16px;
                  line-height: 1.7;
                  color: #4b5563;
                "
              >
                Your caregiver account has been successfully created.
                You can now sign in using the credentials below.
              </p>

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  background-color: #f8fafc;
                  border: 1px solid #e5e7eb;
                  border-radius: 12px;
                  margin-bottom: 28px;
                "
              >
                <tr>
                  <td style="padding: 24px;">

                    <p
                      style="
                        margin: 0 0 8px;
                        font-size: 12px;
                        font-weight: 700;
                        color: #6b7280;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                      "
                    >
                      Email Address
                    </p>

                    <p
                      style="
                        margin: 0 0 22px;
                        font-size: 16px;
                        font-weight: 600;
                        color: #111827;
                        word-break: break-word;
                      "
                    >
                      ${to}
                    </p>

                    <p
                      style="
                        margin: 0 0 8px;
                        font-size: 12px;
                        font-weight: 700;
                        color: #6b7280;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                      "
                    >
                      Temporary Password
                    </p>

                    <div
                      style="
                        display: inline-block;
                        background-color: #ffffff;
                        border: 1px dashed #93c5fd;
                        border-radius: 8px;
                        padding: 12px 16px;
                        font-size: 18px;
                        font-weight: 700;
                        color: #1d4ed8;
                        letter-spacing: 1px;
                        word-break: break-word;
                      "
                    >
                      ${password}
                    </div>

                  </td>
                </tr>
              </table>

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  background-color: #eff6ff;
                  border-left: 4px solid #2563eb;
                  margin-bottom: 28px;
                "
              >
                <tr>
                  <td style="padding: 16px 18px;">

                    <p
                      style="
                        margin: 0 0 6px;
                        font-size: 14px;
                        font-weight: 700;
                        color: #1e40af;
                      "
                    >
                      🔐 Keep your account secure
                    </p>

                    <p
                      style="
                        margin: 0;
                        font-size: 14px;
                        line-height: 1.6;
                        color: #374151;
                      "
                    >
                      This is a temporary password. Please change it
                      immediately after your first sign in and never share
                      your password with anyone.
                    </p>

                  </td>
                </tr>
              </table>

              <p
                style="
                  margin: 0 0 8px;
                  font-size: 14px;
                  line-height: 1.6;
                  color: #6b7280;
                "
              >
                If you did not expect this account to be created,
                please contact your administrator.
              </p>

              <p
                style="
                  margin: 28px 0 0;
                  font-size: 15px;
                  line-height: 1.6;
                  color: #374151;
                "
              >
                Best regards,<br />
                <strong>${APP_NAME} Team</strong>
              </p>

            </td>
          </tr>

          <tr>
            <td
              style="
                background-color: #f8fafc;
                padding: 24px 40px;
                text-align: center;
                border-top: 1px solid #e5e7eb;
              "
            >
              <p
                style="
                  margin: 0;
                  font-size: 12px;
                  line-height: 1.6;
                  color: #9ca3af;
                "
              >
                This is an automated email. Please do not reply directly
                to this message.
              </p>

              <p
                style="
                  margin: 8px 0 0;
                  font-size: 12px;
                  color: #9ca3af;
                "
              >
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

module.exports = {
  sendEmail,
  sendSignupOtpEmail,
  sendForgotPasswordOtpEmail,
  sendLovedOneInvitationEmail,
  sendCaregiverInviteEmail,
  sendCaregiverCredentialsEmail,
};
