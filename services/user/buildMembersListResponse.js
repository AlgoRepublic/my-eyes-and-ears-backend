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
  getTodayMedicationResponse,
  pickNearestUpcomingMedication,
} = require("../medication/medicationHistory");
const { getUtcDateTimeFromDateAndTime } = require("../../utils/utcDateTime");
const {
  buildActiveSosSnapshot,
  findActiveSosByUserIds,
} = require("./sosFormat");

const buildFamilyName = async (familyId) => {
  if (!familyId) {
    return "";
  }

  const family = await Family.findById(familyId).select("name");
  return family?.name || "";
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
    activeSosByUserId,
  ] = await Promise.all([
    ProfileSetting.find({ userId: { $in: memberIds } }),
    Medication.find({ userId: { $in: memberIds } }).sort({ createdAt: 1 }),
    Contact.find({ userId: { $in: memberIds } }).sort({ createdAt: 1 }),
    CheckinReminder.find({ userId: { $in: memberIds } }).sort({ createdAt: 1 }),
    Appointment.find({ userId: { $in: memberIds } }).sort({ createdAt: 1 }),
    findActiveSosByUserIds(memberIds),
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
  const todayMedicationsEntries = await Promise.all(
    memberIds.map(async (memberId) => ({
      userId: String(memberId),
      medications: await getTodayMedicationResponse(memberId),
    })),
  );
  const todayCheckinsByUserId = todayCheckinsEntries.reduce(
    (accumulator, entry) => {
      accumulator.set(entry.userId, entry.checkins);
      return accumulator;
    },
    new Map(),
  );
  const todayMedicationsByUserId = todayMedicationsEntries.reduce(
    (accumulator, entry) => {
      accumulator.set(entry.userId, entry.medications);
      return accumulator;
    },
    new Map(),
  );
  const now = new Date();
  const familyName = await buildFamilyName(members[0]?.familyId);

  return Promise.all(
    members.map(async (member) => {
      const memberMedications =
        medicationsByUserId.get(String(member._id)) || [];
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
      const todayMedications =
        todayMedicationsByUserId.get(String(member._id)) || [];
      const checkinSummary = buildCheckinSummary(todayCheckins, now);
      const activeSos = activeSosByUserId.get(String(member._id)) || null;
      const sosSnapshot = await buildActiveSosSnapshot(activeSos);

      return {
        ...memberResponseWithoutScheduleData,
        ...(includeMedicationCount
          ? { medicationCount: memberMedications.length }
          : {}),
        recentData: {
          upcomingMedication:
            pickNearestUpcomingMedication(todayMedications, now) || null,
          upcomingCheckin: checkinSummary.upcomingCheckin,
          nearestPassedCheckin: checkinSummary.nearestPassedCheckin,
          upcomingAppointment: pickNearestUpcomingAppointment(
            memberResponse.appointments,
            now,
          ),
          sosStatus: member.sosStatus || sosSnapshot.sosStatus || null,
          ...(sosSnapshot.sosStatus === "active"
            ? {
                sosTriggeredAt: sosSnapshot.sosTriggeredAt,
                sosLocation: sosSnapshot.sosLocation,
                sosAcknowledgements: sosSnapshot.sosAcknowledgements,
              }
            : {}),
        },
      };
    }),
  );
};

module.exports = {
  buildMembersListResponse,
};
