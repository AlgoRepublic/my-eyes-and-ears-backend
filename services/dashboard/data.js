const User = require("../../models/user");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { buildParentRecentData } = require("../user/buildParentRecentData");
const { buildMembersListResponse } = require("../user/buildMembersListResponse");
const { getTotalUnreadCountService } = require("../chat/conversations");
const { getTodayMedicationResponse } = require("../medication/medicationHistory");

const countMedicationDues = (medications = []) =>
  medications.filter((medication) => medication?.status !== "taken").length;

const loadDashboardUser = async (userId) =>
  User.findOne({
    _id: userId,
    ...ACTIVE_USER_FILTER,
  });

const getFamilyMembersForCaregiver = async (user) => {
  const familyId = await getFamilyIdOrThrow(user);
  return User.find({
    familyId,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  }).sort({ createdAt: 1 });
};

const buildMessageUnreadCountPayload = async (user) => {
  const { unreadCount } = await getTotalUnreadCountService(user);
  return { unreadCount };
};

const buildMedicationsDueCountPayload = async (user) => {
  if (user.role === "parent") {
    const medications = await getTodayMedicationResponse(user._id);
    return { dueCount: countMedicationDues(medications) };
  }

  if (user.role === "caregiver") {
    const members = await getFamilyMembersForCaregiver(user);
    const membersDueCounts = await Promise.all(
      members.map(async (member) => {
        const medications = await getTodayMedicationResponse(member._id);
        return {
          userId: String(member._id),
          dueCount: countMedicationDues(medications),
        };
      }),
    );
    return { members: membersDueCounts };
  }

  return { dueCount: 0 };
};

const buildRecentMedicationPayload = async (user) => {
  if (user.role === "parent") {
    const { recentData } = await buildParentRecentData(user._id);
    return { upcomingMedication: recentData.upcomingMedication ?? null };
  }

  if (user.role === "caregiver") {
    const members = await getFamilyMembersForCaregiver(user);
    const membersResponse = await buildMembersListResponse(members);
    return {
      members: membersResponse.map((member) => ({
        userId: member.id,
        upcomingMedication: member.recentData?.upcomingMedication ?? null,
      })),
    };
  }

  return { upcomingMedication: null };
};

const buildRecentAppointmentPayload = async (user) => {
  if (user.role === "parent") {
    const { recentData } = await buildParentRecentData(user._id);
    return { upcomingAppointment: recentData.upcomingAppointment ?? null };
  }

  if (user.role === "caregiver") {
    const members = await getFamilyMembersForCaregiver(user);
    const membersResponse = await buildMembersListResponse(members);
    return {
      members: membersResponse.map((member) => ({
        userId: member.id,
        upcomingAppointment: member.recentData?.upcomingAppointment ?? null,
      })),
    };
  }

  return { upcomingAppointment: null };
};

const buildRecentUpcomingCheckinPayload = async (user) => {
  if (user.role === "parent") {
    const { recentData } = await buildParentRecentData(user._id);
    return { upcomingCheckin: recentData.upcomingCheckin ?? null };
  }

  if (user.role === "caregiver") {
    const members = await getFamilyMembersForCaregiver(user);
    const membersResponse = await buildMembersListResponse(members);
    return {
      members: membersResponse.map((member) => ({
        userId: member.id,
        upcomingCheckin: member.recentData?.upcomingCheckin ?? null,
      })),
    };
  }

  return { upcomingCheckin: null };
};

const buildRecentNearestPassedCheckinPayload = async (user) => {
  if (user.role === "parent") {
    const { recentData } = await buildParentRecentData(user._id);
    return { nearestPassedCheckin: recentData.nearestPassedCheckin ?? null };
  }

  if (user.role === "caregiver") {
    const members = await getFamilyMembersForCaregiver(user);
    const membersResponse = await buildMembersListResponse(members);
    return {
      members: membersResponse.map((member) => ({
        userId: member.id,
        nearestPassedCheckin: member.recentData?.nearestPassedCheckin ?? null,
      })),
    };
  }

  return { nearestPassedCheckin: null };
};

const DASHBOARD_EVENT_BUILDERS = {
  "message:unread-count": buildMessageUnreadCountPayload,
  "medications:due_count": buildMedicationsDueCountPayload,
  "recentData:medication": buildRecentMedicationPayload,
  "recentData:appointment": buildRecentAppointmentPayload,
  "recentData:upcomingCheckin": buildRecentUpcomingCheckinPayload,
  "recentData:nearestPassedCheckin": buildRecentNearestPassedCheckinPayload,
};

const buildDashboardEventPayload = async (userId, eventName) => {
  const builder = DASHBOARD_EVENT_BUILDERS[eventName];
  if (!builder) {
    return null;
  }

  const user = await loadDashboardUser(userId);
  if (!user) {
    return null;
  }

  return builder(user);
};

module.exports = {
  DASHBOARD_EVENT_BUILDERS,
  buildDashboardEventPayload,
  buildMessageUnreadCountPayload,
  buildMedicationsDueCountPayload,
  buildRecentMedicationPayload,
  buildRecentAppointmentPayload,
  buildRecentUpcomingCheckinPayload,
  buildRecentNearestPassedCheckinPayload,
};
