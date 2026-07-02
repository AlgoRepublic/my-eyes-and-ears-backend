const jwt = require("jsonwebtoken");
const User = require("../../models/user");
const ProfileSetting = require("../../models/profileSetting");
const Medication = require("../../models/medication");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const Appointment = require("../../models/appointment");
const { CustomError } = require("../../utils/error");

const signAccessToken = (user) => {
  return jwt.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
  });
};

const parentLoginService = async (invitationCode, role) => {
  const normalizedInvitationCode = String(invitationCode || "")
    .trim()
    .toUpperCase();
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim();

  if (!normalizedInvitationCode || !normalizedRole) {
    throw new CustomError("invitationCode and role are required", [], 400);
  }

  if (normalizedRole !== "parent") {
    throw new CustomError("Invalid role for invitation login", [], 403);
  }

  const parentUser = await User.findOne({
    familyInvitationCode: normalizedInvitationCode,
    role: "parent",
  });

  if (!parentUser) {
    throw new CustomError("Invalid invitation code", [], 404);
  }

  const [
    profileSetting,
    medications,
    contacts,
    checkinReminders,
    appointments,
  ] = await Promise.all([
    ProfileSetting.findOne({ userId: parentUser._id }),
    Medication.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    Contact.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    CheckinReminder.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    Appointment.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
  ]);

  const accessToken = signAccessToken(parentUser);

  return {
    user: {
      id: parentUser._id,
      role: parentUser.role,
      name: parentUser.name,
      email: parentUser.email,
      phoneNumber: parentUser.phoneNumber,
      relation: parentUser.relation,
      caregiverId: parentUser.caregiverId,
      familyInvitationCode: parentUser.familyInvitationCode,
      isProfileCompleted: parentUser.isProfileCompleted,
      createdAt: parentUser.createdAt,
      updatedAt: parentUser.updatedAt,
    },
    profileSetting: profileSetting
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
    medications: medications.map((item) => ({
      id: item._id,
      userId: item.userId,
      name: item.name,
      dosage: item.dosage,
      frequency: item.frequency,
      startDate: item.startDate,
      endDate: item.endDate,
      notes: item.notes,
      time: item.time,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    contacts: contacts.map((item) => ({
      id: item._id,
      userId: item.userId,
      name: item.name,
      phoneNumber: item.phoneNumber,
      relationship: item.relationship,
      isPrimary: item.isPrimary,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    checkinReminders: checkinReminders.map((item) => ({
      id: item._id,
      userId: item.userId,
      time: item.time,
      label: item.label,
      isEnabled: item.isEnabled,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    appointments: appointments.map((item) => ({
      id: item._id,
      userId: item.userId,
      doctorName: item.doctorName,
      reason: item.reason,
      date: item.date,
      time: item.time,
      location: item.location,
      rider: item.rider,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    accessToken,
    message: "Parent login successful",
  };
};

module.exports = {
  parentLoginService,
};
