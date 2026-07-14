const jwt = require("jsonwebtoken");
const User = require("../../models/user");
const ProfileSetting = require("../../models/profileSetting");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const {
  getTodayMedicationResponse,
} = require("../medication/medicationHistory");
const {
  getDashboardAppointments,
} = require("../appointment/dashboardAppointments");
const { addFcmTokenToUser } = require("./fcmToken");
const { CustomError } = require("../../utils/error");

const signAccessToken = (user) => {
  return jwt.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
  });
};

const parentLoginService = async (invitationCode, role, fcmToken) => {
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

  const hasUpdatedFcmToken = addFcmTokenToUser(parentUser, fcmToken);
  if (hasUpdatedFcmToken) {
    await parentUser.save();
  }

  const [
    profileSetting,
    medications,
    contacts,
    checkinReminders,
    dashboardAppointments,
  ] = await Promise.all([
    ProfileSetting.findOne({ userId: parentUser._id }),
    getTodayMedicationResponse(parentUser._id),
    Contact.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    CheckinReminder.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    getDashboardAppointments(parentUser._id),
  ]);

  const accessToken = signAccessToken(parentUser);
  const refreshToken = jwt.sign(
    { id: parentUser.id, type: "refresh" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "90d",
    },
  );

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
      hasPassword: Boolean(parentUser.password),
      createdAt: parentUser.createdAt,
      updatedAt: parentUser.updatedAt,
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
      medicationDuesCount: medications.filter((med) => med.status === "due")
        .length,
      medications,
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
      upcomingAppointment: dashboardAppointments.upcomingAppointment,
      appointments: dashboardAppointments.appointments,
      accessToken,
      refreshToken,
    },

    message: "Parent login successful",
  };
};

module.exports = {
  parentLoginService,
};
