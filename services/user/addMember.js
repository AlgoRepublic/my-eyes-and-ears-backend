const User = require("../../models/user");
const Family = require("../../models/family");
const ProfileSetting = require("../../models/profileSetting");
const Medication = require("../../models/medication");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const Appointment = require("../../models/appointment");
const { CustomError } = require("../../utils/error");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const {
  buildInvitationDetails,
  buildUniqueInvitationCode,
} = require("./invitation");
const { buildMedicationSchedule } = require("./medicationSchedule");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { parseDateInputToUtc } = require("../../utils/utcDateTime");
const { sendEmail } = require("../notification/email");

const buildFamilyName = async (familyId) => {
  const family = await Family.findById(familyId);
  return family?.name || "";
};

const buildMemberResponse = ({
  parentUser,
  familyName = "",
  profileSetting,
  medications = [],
  contacts = [],
  checkinReminders = [],
  appointments = [],
}) => {
  return {
    id: parentUser._id,
    role: parentUser.role,
    caregiverId: parentUser.caregiverId,
    familyId: parentUser.familyId,
    name: parentUser.name,
    email: parentUser.email,
    phoneNumber: parentUser.phoneNumber,
    relation: parentUser.relation,
    avatarColor: parentUser.avatarColor,
    image: parentUser.image,
    location: parentUser.location,
    invitation: buildInvitationDetails(parentUser),
    familyName: familyName || "",
    isProfileCompleted: parentUser.isProfileCompleted,
    missedCheckInAlerts: parentUser.missedCheckInAlerts,
    isEmailVerified: parentUser.isEmailVerified,
    createdAt: parentUser.createdAt,
    updatedAt: parentUser.updatedAt,
    medications: medications.map((item) => ({
      id: item._id,
      userId: item.userId,
      name: item.name,
      dosage: item.dosage,
      frequency: item.frequency,
      days: item.days || [],
      dates: item.dates || [],
      startDate: item.startDate,
      endDate: item.endDate,
      notes: item.notes,
      time: item.time,
    })),
    accessibilities: profileSetting
      ? {
          id: profileSetting._id,
          userId: profileSetting.userId,
          fontSize: profileSetting.fontSize,
          highContrast: profileSetting.highContrast,
          voiceAssistance: profileSetting.voiceAssistance,
          createdAt: profileSetting.createdAt,
          updatedAt: profileSetting.updatedAt,
        }
      : null,
    contacts: contacts.map((item) => ({
      id: item._id,
      userId: item.userId,
      name: item.name,
      phoneNumber: item.phoneNumber,
      relationship: item.relationship,
      isPrimary: item.isPrimary,
    })),
    checkinReminders: checkinReminders.map((item) => ({
      id: item._id,
      userId: item.userId,
      time: item.time,
      label: item.label,
      isEnabled: item.isEnabled,
    })),
    appointments: appointments.map((item) => ({
      id: item._id,
      userId: item.userId,
      doctorName: item.doctorName,
      reason: item.reason,
      date: item.date,
      time: item.time,
      location: item.location,
      clinicPhone: item.clinicPhone,
      note: item.note,
      rider: item.rider,
      status: item.status,
    })),
  };
};

const isInvitationCodeDuplicateError = (error) => {
  return (
    error?.code === 11000 &&
    (Boolean(error?.keyPattern?.familyInvitationCode) ||
      Boolean(error?.keyValue?.familyInvitationCode) ||
      String(error?.message || "").includes("familyInvitationCode"))
  );
};

const parseOptionalDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return parseDateInputToUtc(value);
};

const addMemberService = async (currentUser, data = {}) => {
  const caregiverId = getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);

  const userPayload = data.user || {};
  const elderModePayload = userPayload?.accessibilities || {};
  const medicationsPayload = Array.isArray(userPayload?.medications)
    ? userPayload.medications
    : [];
  const contactsPayload = Array.isArray(userPayload?.contacts)
    ? userPayload.contacts
    : [];
  const remindersPayload = Array.isArray(userPayload?.checkinReminders)
    ? userPayload.checkinReminders
    : [];
  const appointmentsPayload = Array.isArray(userPayload?.appointments)
    ? userPayload.appointments
    : [];

  const name = String(userPayload.name || "").trim();
  const relation = userPayload.relation
    ? String(userPayload.relation).trim()
    : null;
  const email = userPayload.email
    ? String(userPayload.email).toLowerCase().trim()
    : null;
  const phoneNumber = userPayload.phoneNumber
    ? String(userPayload.phoneNumber).trim()
    : null;
  const location = userPayload.location
    ? String(userPayload.location).trim()
    : null;
  const missedCheckInAlerts =
    userPayload.missedCheckInAlerts !== undefined
      ? Boolean(userPayload.missedCheckInAlerts)
      : true;

  if (!name) {
    throw new CustomError("Parent name is required", [], 400);
  }

  if (email) {
    const existingEmail = await User.findOne({
      email,
      ...ACTIVE_USER_FILTER,
    }).select("_id");
    if (existingEmail) {
      throw new CustomError("Email already exists", [], 400);
    }
  }

  if (phoneNumber) {
    const existingPhone = await User.findOne({
      phoneNumber,
      ...ACTIVE_USER_FILTER,
    }).select("_id");
    if (existingPhone) {
      throw new CustomError("Phone number already exists", [], 400);
    }
  }

  const lastInvitationTime = new Date();
  let invitationCode = null;

  let parentUser;
  let profileSetting;
  let createdMedications = [];
  let createdContacts = [];
  let createdReminders = [];
  let createdAppointments = [];

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      invitationCode = await buildUniqueInvitationCode();

      try {
        parentUser = await User.create({
          name,
          email,
          phoneNumber,
          role: "parent",
          relation,
          avatarColor: userPayload.avatarColor || null,
          image: userPayload.image || null,
          location,
          caregiverId,
          familyId,
          familyInvitationCode: invitationCode,
          lastInvitationTime,
          isProfileCompleted: true,
          missedCheckInAlerts,
          isEmailVerified: false,
          password: null,
        });

        break;
      } catch (error) {
        if (!isInvitationCodeDuplicateError(error) || attempt === 9) {
          throw error;
        }
      }
    }

    if (!parentUser) {
      throw new CustomError("Unable to assign unique invitation code", [], 500);
    }

    profileSetting = await ProfileSetting.create({
      userId: parentUser._id,
      fontSize: elderModePayload.fontSize || null,
      highContrast: Boolean(elderModePayload.highContrast),
      voiceAssistance: Boolean(elderModePayload.voiceAssistance),
    });

    if (medicationsPayload.length > 0) {
      const medicationDocs = medicationsPayload
        .filter((item) => item && item.name)
        .map((item) => {
          const schedule = buildMedicationSchedule({
            frequency: item.frequency,
            days: item.days,
            dates: item.dates,
          });

          return {
            userId: parentUser._id,
            name: String(item.name).trim(),
            dosage: item.dosage ? String(item.dosage).trim() : null,
            frequency: schedule.frequency,
            days: schedule.days,
            dates: schedule.dates,
            startDate: parseOptionalDate(item.startDate),
            endDate: parseOptionalDate(item.endDate),
            notes: item.notes ? String(item.notes).trim() : null,
            time: item.time ? String(item.time).trim() : null,
          };
        });

      if (medicationDocs.length > 0) {
        createdMedications = await Medication.insertMany(medicationDocs);
      }
    }

    if (contactsPayload.length > 0) {
      const contactDocs = contactsPayload
        .filter((item) => item && item.name && item.phoneNumber)
        .map((item) => ({
          userId: parentUser._id,
          name: String(item.name).trim(),
          phoneNumber: String(item.phoneNumber).trim(),
          relationship: item.relationship
            ? String(item.relationship).trim()
            : null,
        }));

      if (contactDocs.length > 0) {
        createdContacts = await Contact.insertMany(contactDocs);
      }
    }

    if (remindersPayload.length > 0) {
      const reminderDocs = remindersPayload
        .filter((item) => item && item.time)
        .map((item) => ({
          userId: parentUser._id,
          time: String(item.time).trim(),
          label: item.label ? String(item.label).trim() : null,
          isEnabled:
            item.isEnabled !== undefined ? Boolean(item.isEnabled) : true,
        }));

      if (reminderDocs.length > 0) {
        createdReminders = await CheckinReminder.insertMany(reminderDocs);
      }
    }

    if (appointmentsPayload.length > 0) {
      const appointmentDocs = appointmentsPayload
        .filter((item) => item && item.doctorName)
        .map((item) => ({
          userId: parentUser._id,
          doctorName: String(item.doctorName).trim(),
          reason: item.reason ? String(item.reason).trim() : null,
          date: parseOptionalDate(item.date),
          time: item.time ? String(item.time).trim() : null,
          location: item.location ? String(item.location).trim() : null,
          clinicPhone: item.clinicPhone
            ? String(item.clinicPhone).trim()
            : null,
          note: item.note ? String(item.note).trim() : null,
          rider: item.rider ? String(item.rider).trim() : null,
        }));

      if (appointmentDocs.length > 0) {
        createdAppointments = await Appointment.insertMany(appointmentDocs);
      }
    }
  } catch (error) {
    if (createdAppointments.length > 0) {
      await Appointment.deleteMany({
        _id: { $in: createdAppointments.map((doc) => doc._id) },
      });
    }

    if (createdReminders.length > 0) {
      await CheckinReminder.deleteMany({
        _id: { $in: createdReminders.map((doc) => doc._id) },
      });
    }

    if (createdContacts.length > 0) {
      await Contact.deleteMany({
        _id: { $in: createdContacts.map((doc) => doc._id) },
      });
    }

    if (createdMedications.length > 0) {
      await Medication.deleteMany({
        _id: { $in: createdMedications.map((doc) => doc._id) },
      });
    }

    if (profileSetting?._id) {
      await ProfileSetting.deleteOne({ _id: profileSetting._id });
    }

    if (parentUser?._id) {
      await User.deleteOne({ _id: parentUser._id });
    }

    throw error;
  }

  const familyName = await buildFamilyName(familyId);
  // send email to member
  // const sendEmail = async ({ to, subject, text, html })
  // beautiful template for sending email to member
  await sendEmail({
    to: email,

    subject: "You're invited to My Eyes & Ears",

    text: [
      `Hello ${name},`,
      "",
      "You've been invited to join the My Eyes & Ears app as a family member.",
      "",
      `Your invitation code is: ${invitationCode}`,
      "",
      "Please enter this invitation code in the app to complete your registration.",
      "",
      "If you were not expecting this invitation, you can safely ignore this email.",
      "",
      "Best regards,",
      "My Eyes & Ears Team",
    ].join("\n"),

    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>You're Invited to My Eyes &amp; Ears</title>
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
    style="
      background-color: #f4f7fb;
      padding: 40px 16px;
    "
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
                Family Care Made Simple
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
                You're Invited, ${name}! 👋
              </h1>

              <p
                style="
                  margin: 0 0 24px;
                  font-size: 16px;
                  line-height: 1.7;
                  color: #4b5563;
                "
              >
                You've been added as a family member to
                <strong>My Eyes &amp; Ears</strong>.
                Use the invitation code below in the app to complete
                your registration.
              </p>

              <!-- Invitation Code -->
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
                  <td
                    style="
                      padding: 28px;
                      text-align: center;
                    "
                  >

                    <p
                      style="
                        margin: 0 0 12px;
                        font-size: 12px;
                        font-weight: 700;
                        color: #6b7280;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                      "
                    >
                      Your Invitation Code
                    </p>

                    <div
                      style="
                        display: inline-block;
                        background-color: #ffffff;
                        border: 2px dashed #93c5fd;
                        border-radius: 10px;
                        padding: 14px 24px;
                        font-size: 28px;
                        font-weight: 700;
                        color: #1d4ed8;
                        letter-spacing: 4px;
                      "
                    >
                      ${invitationCode}
                    </div>

                    <p
                      style="
                        margin: 16px 0 0;
                        font-size: 13px;
                        color: #6b7280;
                      "
                    >
                      Enter this code in the My Eyes &amp; Ears app.
                    </p>

                  </td>
                </tr>
              </table>

              <!-- Information -->
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
                      How to get started
                    </p>

                    <p
                      style="
                        margin: 0;
                        font-size: 14px;
                        line-height: 1.6;
                        color: #374151;
                      "
                    >
                      Open the My Eyes &amp; Ears app and enter the
                      invitation code when prompted to complete your
                      registration.
                    </p>

                  </td>
                </tr>
              </table>

              <p
                style="
                  margin: 0;
                  font-size: 14px;
                  line-height: 1.6;
                  color: #6b7280;
                "
              >
                If you were not expecting this invitation, you can
                safely ignore this email.
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
                This is an automated email. Please do not reply
                directly to this message.
              </p>

              <p
                style="
                  margin: 8px 0 0;
                  font-size: 12px;
                  color: #9ca3af;
                "
              >
                © ${new Date().getFullYear()}
                My Eyes &amp; Ears. All rights reserved.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `,
  });

  return {
    user: {
      ...buildMemberResponse({
        parentUser,
        familyName,
        profileSetting,
        medications: createdMedications,
        contacts: createdContacts,
        checkinReminders: createdReminders,
        appointments: createdAppointments,
      }),
    },

    // invitationUrl: `https://api.myeyesandears.com/invite/${invitationCode}`,
  };
};

module.exports = {
  addMemberService,
  buildMemberResponse,
};
