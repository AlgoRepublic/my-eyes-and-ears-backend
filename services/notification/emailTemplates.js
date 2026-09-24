const APP_NAME = "My Eyes & Ears";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const wrapInEmailLayout = ({ title, bodyHtml }) => {
  const safeTitle = escapeHtml(title);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f7fb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color:#2563eb;padding:32px 40px;text-align:center;">
              <div style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${APP_NAME}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                This is an automated email. Please do not reply directly to this message.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const buildOtpEmail = ({
  recipientName,
  otp,
  expiresMinutes,
  purposeTitle,
  purposeDescription,
}) => {
  const safeName = escapeHtml(recipientName || "there");
  const safeOtp = escapeHtml(otp);
  const safeTitle = escapeHtml(purposeTitle);

  const text = [
    `Hi ${recipientName || "there"},`,
    "",
    purposeDescription,
    "",
    `Your verification code: ${otp}`,
    `This code expires in ${expiresMinutes} minutes.`,
    "",
    "If you did not request this code, you can ignore this email.",
    "",
    `Best regards,`,
    `${APP_NAME} Team`,
  ].join("\n");

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:26px;line-height:1.3;color:#111827;">${safeTitle}</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#4b5563;">
      Hi ${safeName},
    </p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#4b5563;">
      ${escapeHtml(purposeDescription)}
    </p>
    <div style="display:inline-block;background-color:#f8fafc;border:1px dashed #93c5fd;border-radius:8px;padding:16px 24px;font-size:28px;font-weight:700;color:#1d4ed8;letter-spacing:6px;margin-bottom:24px;">
      ${safeOtp}
    </div>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
      This code expires in ${expiresMinutes} minutes. If you did not request this code, you can safely ignore this email.
    </p>
  `;

  const html = wrapInEmailLayout({ title: purposeTitle, bodyHtml });

  return { text, html };
};

const buildLovedOneInvitationEmail = ({
  lovedOneName,
  inviterName,
  invitationCode,
}) => {
  const safeLovedOne = lovedOneName || "there";
  const safeInviter = inviterName || "Your caregiver";
  const subject = `${safeInviter} invited you to ${APP_NAME}`;

  const textLines = [
    `Hi ${safeLovedOne},`,
    "",
    `${safeInviter} has invited you to join their family on ${APP_NAME}.`,
    "",
    `Your invitation code: ${invitationCode}`,
  ];

  textLines.push(
    "",
    "Download the app, choose Loved One sign-in, and enter your invitation code to activate your account.",
    "",
    "This invitation expires in 7 days.",
    "",
    `Best regards,`,
    `${APP_NAME} Team`,
  );

  const text = textLines.join("\n");

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:26px;line-height:1.3;color:#111827;">You're invited 💙</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#4b5563;">
      Hi ${escapeHtml(safeLovedOne)},
    </p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#4b5563;">
      <strong>${escapeHtml(safeInviter)}</strong> has invited you to join their family on ${APP_NAME}.
    </p>
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
      Invitation code
    </p>
    <div style="display:inline-block;background-color:#f8fafc;border:1px dashed #93c5fd;border-radius:8px;padding:14px 20px;font-size:22px;font-weight:700;color:#1d4ed8;letter-spacing:3px;margin-bottom:24px;">
      ${escapeHtml(invitationCode)}
    </div>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
      Download the app, sign in as a Loved One, and enter this code. The invitation expires in 7 days.
    </p>
  `;

  const html = wrapInEmailLayout({ title: subject, bodyHtml });

  return { subject, text, html };
};

const buildCaregiverInviteEmail = ({
  caregiverName,
  inviterName,
  familyName,
}) => {
  const safeName = caregiverName || "Caregiver";
  const safeInviter = inviterName || "A caregiver";
  const safeFamily = familyName ? ` (${familyName})` : "";
  const subject = `${safeInviter} added you as a caregiver on ${APP_NAME}`;

  const text = [
    `Hi ${safeName},`,
    "",
    `${safeInviter} has invited you to join${safeFamily} on ${APP_NAME} as a caregiver.`,
    "",
    "You will receive a separate email with your sign-in email and temporary password.",
    "",
    `Best regards,`,
    `${APP_NAME} Team`,
  ].join("\n");

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:26px;line-height:1.3;color:#111827;">Caregiver invitation</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#4b5563;">
      Hi ${escapeHtml(safeName)},
    </p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#4b5563;">
      <strong>${escapeHtml(safeInviter)}</strong> has invited you to join
      <strong>${escapeHtml(familyName || "their family")}</strong> on ${APP_NAME} as a caregiver.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
      Check your inbox for a follow-up email with your login email and temporary password.
    </p>
  `;

  const html = wrapInEmailLayout({ title: subject, bodyHtml });

  return { subject, text, html };
};

module.exports = {
  APP_NAME,
  buildOtpEmail,
  buildLovedOneInvitationEmail,
  buildCaregiverInviteEmail,
};
