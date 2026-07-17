const { CustomError } = require("../../utils/error");
const User = require("../../models/user");
const ProfileSetting = require("../../models/profileSetting");
const Medication = require("../../models/medication");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const Appointment = require("../../models/appointment");
const { buildMemberResponse } = require("./addMember");

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

const getMemberDetailService = async (currentUser, userId) => {
  const caregiverId = currentUser?._id || currentUser?.id;
  const normalizedUserId = String(userId || "").trim();

  if (!caregiverId) {
    throw new CustomError("Authenticated caregiver is required", [], 401);
  }

  if (currentUser?.role && currentUser.role !== "caregiver") {
    throw new CustomError("Only caregivers can view family members", [], 403);
  }

  if (!normalizedUserId) {
    throw new CustomError("userId is required", [], 400);
  }

  const parentUser = await User.findOne({
    _id: normalizedUserId,
    caregiverId,
    role: "parent",
  });

  if (!parentUser) {
    throw new CustomError("Parent member not found", [], 404);
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

  const memberResponse = buildMemberResponse({
    parentUser,
    profileSetting,
    medications,
    contacts,
    checkinReminders,
    appointments,
  });

  const now = new Date();
  const member = {
    ...memberResponse,
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

  if (!member) {
    throw new CustomError("Member not found", [], 404);
  }

  return {
    member,
  };
};

module.exports = {
  getMemberDetailService,
};
