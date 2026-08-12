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
            startDate: item.startDate ? new Date(item.startDate) : null,
            endDate: item.endDate ? new Date(item.endDate) : null,
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
          date: item.date ? new Date(item.date) : null,
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
