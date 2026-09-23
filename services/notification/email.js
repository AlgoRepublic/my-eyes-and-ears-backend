let nodemailer = null;
let cachedTransporter = null;

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
// 4725aa21848f1ec11fec2f143b911bf2

const getSmtpConfigOrThrow = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const secure =
    process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465";

  if (!host || !user || !pass || !from) {
    throw new Error(
      "Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM",
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
    from,
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

const sendEmail = async ({ to, subject, text, html }) => {
  if (!to) {
    throw new Error("Email recipient is required");
  }

  const smtpConfig = getSmtpConfigOrThrow();
  const transporter = getTransporter();

  return transporter.sendMail({
    from: smtpConfig.from,
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

  const subject = "Welcome to My Eyes & Ears — Your Caregiver Account";

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
    "My Eyes & Ears Team",
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

        <!-- Main Container -->
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

          <!-- Header -->
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
                My Eyes &amp; Ears
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

          <!-- Content -->
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

              <!-- Credentials Box -->
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

              <!-- Security Notice -->
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
                <strong>My Eyes &amp; Ears Team</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
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
                © ${new Date().getFullYear()} My Eyes &amp; Ears. All rights reserved.
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
  sendCaregiverCredentialsEmail,
};
