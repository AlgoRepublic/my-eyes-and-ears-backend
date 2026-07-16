const User = require("../../models/user");
const ProfileSetting = require("../../models/profileSetting");
const Medication = require("../../models/medication");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const Appointment = require("../../models/appointment");
const { CustomError } = require("../../utils/error");
const { buildMemberResponse } = require("./addMember");

const groupByUserId = (items = []) => {
  return items.reduce((accumulator, item) => {
    const userId = String(item.userId);
    if (!accumulator.has(userId)) {
      accumulator.set(userId, []);
    }
    accumulator.get(userId).push(item);
    return accumulator;
  }, new Map());
};

const getMembersService = async (currentUser) => {
  const caregiverId = currentUser?._id || currentUser?.id;

  if (!caregiverId) {
    throw new CustomError("Authenticated caregiver is required", [], 401);
  }

  if (currentUser?.role && currentUser.role !== "caregiver") {
    throw new CustomError("Only caregivers can view family members", [], 403);
  }

  const members = await User.find({
    caregiverId,
    role: "parent",
  }).sort({ createdAt: 1 });

  if (members.length === 0) {
    return {
      members: [],
    };
  }

  const memberIds = members.map((member) => member._id);

  const [
    profileSettings,
    medications,
    contacts,
    checkinReminders,
    appointments,
  ] = await Promise.all([
    ProfileSetting.find({ userId: { $in: memberIds } }),
    Medication.find({ userId: { $in: memberIds } }).sort({ createdAt: 1 }),
    Contact.find({ userId: { $in: memberIds } }).sort({ createdAt: 1 }),
    CheckinReminder.find({ userId: { $in: memberIds } }).sort({ createdAt: 1 }),
    Appointment.find({ userId: { $in: memberIds } }).sort({ createdAt: 1 }),
  ]);

  const profileSettingByUserId = profileSettings.reduce((accumulator, item) => {
    accumulator.set(String(item.userId), item);
    return accumulator;
  }, new Map());

  const medicationsByUserId = groupByUserId(medications);
  const contactsByUserId = groupByUserId(contacts);
  const remindersByUserId = groupByUserId(checkinReminders);
  const appointmentsByUserId = groupByUserId(appointments);

  return {
    members: members.map((member) => ({
      ...buildMemberResponse({
        parentUser: member,
        profileSetting: profileSettingByUserId.get(String(member._id)) || null,
        medications: medicationsByUserId.get(String(member._id)) || [],
        contacts: contactsByUserId.get(String(member._id)) || [],
        checkinReminders: remindersByUserId.get(String(member._id)) || [],
        appointments: appointmentsByUserId.get(String(member._id)) || [],
      }),
      invitationCode: member.familyInvitationCode,
    })),
  };
};

module.exports = {
  getMembersService,
};
