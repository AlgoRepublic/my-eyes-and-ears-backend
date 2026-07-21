const User = require("../../models/user");
const ProfileSetting = require("../../models/profileSetting");
const Medication = require("../../models/medication");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const Appointment = require("../../models/appointment");
const { buildMemberResponse } = require("./addMember");
const {
  getCaregiverIdOrThrow,
} = require("./memberAccess");
const { getFamilyIdOrThrow } = require("../family/familyAccess");

const parseTimeParts = (timeValue) => {
  if (!timeValue) return null;

  const raw = String(timeValue).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return null;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
  } else if (hours > 23) {
    return null;
  }

  return { hours, minutes };
};

const getDateTimeForTodayTime = (timeValue, now = new Date()) => {
  const timeParts = parseTimeParts(timeValue);
  if (!timeParts) return null;

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    timeParts.hours,
    timeParts.minutes,
    0,
    0,
  );
};

const getAppointmentDateTime = (appointment) => {
  if (!appointment?.date) return null;

  const baseDate = new Date(appointment.date);
  if (Number.isNaN(baseDate.getTime())) return null;

  const timeParts = parseTimeParts(appointment.time);
  if (!timeParts) {
    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      0,
      0,
      0,
      0,
    );
  }

  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    timeParts.hours,
    timeParts.minutes,
    0,
    0,
  );
};

const pickNearestUpcomingByTime = (
  items = [],
  timeAccessor,
  now = new Date(),
) => {
  let nearest = null;
  let nearestDateTime = null;

  for (const item of items) {
    const dateTime = getDateTimeForTodayTime(timeAccessor(item), now);
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
    if (appointment?.status && appointment.status !== "scheduled") {
      continue;
    }

    const dateTime = getAppointmentDateTime(appointment);
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

const getMembersService = async (currentUser) => {
  getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);

  const members = await User.find({
    familyId,
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
  const now = new Date();

  return {
    members: members.map((member) => {
      const memberResponse = buildMemberResponse({
        parentUser: member,
        profileSetting: profileSettingByUserId.get(String(member._id)) || null,
        medications: medicationsByUserId.get(String(member._id)) || [],
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

      return {
        ...memberResponseWithoutScheduleData,
        recentData: {
          upcomingMedication: (() => {
            const item = pickNearestUpcomingByTime(
              memberResponse.medications,
              (medication) => medication.time,
              now,
            );
            return item ? { ...item, status: "due" } : null;
          })(),
          upcomingCheckin: pickNearestUpcomingByTime(
            memberResponse.checkinReminders,
            (item) => item.time,
            now,
          ),
          upcomingAppointment: pickNearestUpcomingAppointment(
            memberResponse.appointments,
            now,
          ),
          sosStatus: null,
        },
      };
    }),
  };
};

module.exports = {
  getMembersService,
};
