const Family = require("../../models/family");
const ProfileSetting = require("../../models/profileSetting");
const Medication = require("../../models/medication");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const Appointment = require("../../models/appointment");
const {
  getTodayCheckinResponse,
  buildCheckinSummary,
} = require("../checkin/checkinHistory");
const { buildMemberResponse } = require("./addMember");
const {
  getUtcDateTimeFromStoredTime,
  getUtcDateTimeFromDateAndTime,
} = require("../../utils/utcDateTime");

const buildFamilyName = async (familyId) => {
  if (!familyId) {
    return "";
  }

  const family = await Family.findById(familyId).select("name");
  return family?.name || "";
};

const pickNearestUpcomingByTime = (
  items = [],
  timeAccessor,
  now = new Date(),
) => {
  let nearest = null;
  let nearestDateTime = null;

  for (const item of items) {
    const dateTime = getUtcDateTimeFromStoredTime(timeAccessor(item), now);
    if (!dateTime || dateTime <= now) continue;

    if (!nearestDateTime || dateTime < nearestDateTime) {
      nearest = item;
      nearestDateTime = dateTime;
    }
  }

  return nearest;
};

const pickNearestUpcomingAppointment = (
  appointments = [],
  now = new Date(),
) => {
  let nearest = null;
  let nearestDateTime = null;

  for (const appointment of appointments) {
    if (
      appointment?.status === "completed" ||
      appointment?.status === "cancelled"
    ) {
      continue;
    }

    const dateTime = getUtcDateTimeFromDateAndTime(
      appointment?.date,
      appointment?.time,
    );
    if (!dateTime || dateTime <= now) continue;

    if (!nearestDateTime || dateTime < nearestDateTime) {
      nearest = appointment;
      nearestDateTime = dateTime;
    }
  }

  return nearest;
};

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

const buildMembersListResponse = async (
  members = [],
  { includeMedicationCount = false } = {},
) => {
  if (members.length === 0) {
    return [];
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
  const todayCheckinsEntries = await Promise.all(
    memberIds.map(async (memberId) => ({
      userId: String(memberId),
      checkins: await getTodayCheckinResponse(memberId),
    })),
  );
  const todayCheckinsByUserId = todayCheckinsEntries.reduce(
    (accumulator, entry) => {
      accumulator.set(entry.userId, entry.checkins);
      return accumulator;
    },
    new Map(),
  );
  const now = new Date();
  const familyName = await buildFamilyName(members[0]?.familyId);

  return members.map((member) => {
    const memberMedications = medicationsByUserId.get(String(member._id)) || [];
    const memberResponse = buildMemberResponse({
      parentUser: member,
      familyName,
      profileSetting: profileSettingByUserId.get(String(member._id)) || null,
      medications: memberMedications,
      contacts: contactsByUserId.get(String(member._id)) || [],
      checkinReminders: remindersByUserId.get(String(member._id)) || [],
      appointments: appointmentsByUserId.get(String(member._id)) || [],
    });

    const {
      medications: _medications,
      checkinReminders: _checkinReminders,
      appointments: _appointments,
      contacts: _contacts,
      ...memberResponseWithoutScheduleData
    } = memberResponse;

    const todayCheckins = todayCheckinsByUserId.get(String(member._id)) || [];
    const checkinSummary = buildCheckinSummary(todayCheckins, now);

    return {
      ...memberResponseWithoutScheduleData,
      ...(includeMedicationCount
        ? { medicationCount: memberMedications.length }
        : {}),
      recentData: {
        upcomingMedication: (() => {
          const item = pickNearestUpcomingByTime(
            memberResponse.medications,
            (medication) => medication.time,
            now,
          );
          return item ? { ...item, status: "due" } : null;
        })(),
        upcomingCheckin: checkinSummary.upcomingCheckin,
        nearestPassedCheckin: checkinSummary.nearestPassedCheckin,
        upcomingAppointment: pickNearestUpcomingAppointment(
          memberResponse.appointments,
          now,
        ),
        sosStatus: null,
      },
    };
  });
};

module.exports = {
  buildMembersListResponse,
};
