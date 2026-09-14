const Family = require("../../models/family");
const User = require("../../models/user");
const CheckinHistory = require("../../models/checkinHistory");
const Medication = require("../../models/medication");
const MedicationHistory = require("../../models/medicationHistory");
const Sos = require("../../models/sos");
const Conversation = require("../../models/conversation");
const Message = require("../../models/message");
const mongoose = require("mongoose");
const { CustomError } = require("../../utils/error");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const {
  getUtcStartOfDay,
  getUtcWeekDayName,
  isSameUtcDay,
  parseDateInputToUtc,
} = require("../../utils/utcDateTime");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { buildInvitationDetails } = require("./invitation");

const WEEKDAY_NAMES = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]);

const toDisplayCount = (value) => String(Math.max(0, Number(value) || 0));

const resolvePeriod = ({ startDate, endDate } = {}) => {
  const hasStart = startDate !== undefined && startDate !== null && startDate !== "";
  const hasEnd = endDate !== undefined && endDate !== null && endDate !== "";

  if (hasStart !== hasEnd) {
    throw new CustomError("Both startDate and endDate are required", [], 400);
  }

  if (hasStart && hasEnd) {
    const parsedStart = parseDateInputToUtc(startDate);
    const parsedEnd = parseDateInputToUtc(endDate);

    if (!parsedStart || !parsedEnd || parsedEnd < parsedStart) {
      throw new CustomError("Invalid date range", [], 400);
    }

    return {
      startDate: parsedStart,
      endDate: parsedEnd,
    };
  }

  const todayStart = getUtcStartOfDay(new Date());
  const dayOfWeek = todayStart.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisWeekMonday = new Date(todayStart);
  thisWeekMonday.setUTCDate(thisWeekMonday.getUTCDate() - daysSinceMonday);

  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

  const lastWeekSundayEnd = new Date(lastWeekMonday);
  lastWeekSundayEnd.setUTCDate(lastWeekSundayEnd.getUTCDate() + 6);
  lastWeekSundayEnd.setUTCHours(23, 59, 59, 999);

  return {
    startDate: lastWeekMonday,
    endDate: lastWeekSundayEnd,
  };
};

const isMedicationApplicableOnDay = (medication, day) => {
  if (!medication?.isActive) {
    return false;
  }

  const dayStart = getUtcStartOfDay(day);

  if (medication.startDate && getUtcStartOfDay(medication.startDate) > dayStart) {
    return false;
  }

  if (
    medication.endDate &&
    getUtcStartOfDay(medication.endDate) < dayStart
  ) {
    return false;
  }

  if (medication.frequency === "weekly") {
    const selectedDays = Array.isArray(medication.days) ? medication.days : [];
    return selectedDays.includes(getUtcWeekDayName(dayStart));
  }

  if (
    medication.frequency === "once" ||
    medication.frequency === "custom_dates"
  ) {
    const selectedDates = Array.isArray(medication.dates)
      ? medication.dates
      : [];

    return selectedDates.some((dateValue) => {
      const parsedDate = new Date(dateValue);
      if (Number.isNaN(parsedDate.getTime())) {
        return false;
      }
      return isSameUtcDay(parsedDate, dayStart);
    });
  }

  return medication.frequency === "daily";
};

const eachUtcDayInRange = (startDate, endDate) => {
  const days = [];
  const cursor = getUtcStartOfDay(startDate);
  const lastDay = getUtcStartOfDay(endDate);

  while (cursor <= lastDay) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
};

const countScheduledMedicationDoses = (medications, startDate, endDate) => {
  const days = eachUtcDayInRange(startDate, endDate);
  let scheduledCount = 0;

  for (const day of days) {
    for (const medication of medications) {
      if (isMedicationApplicableOnDay(medication, day)) {
        scheduledCount += 1;
      }
    }
  }

  return scheduledCount;
};

const buildPersonCardTitle = (name) => `${name || "Loved one"} had a great week ✨`;

const buildFamilyCardTitle = (totalSosCount) =>
  totalSosCount > 0
    ? "Family had a busy week"
    : "Family had a calm week ✨";

const buildHighlights = ({
  name,
  relation,
  checkIns,
  thinkingOfYou,
  sosCount,
  weekdayMorningCheckInsComplete,
}) => {
  const highlights = [];
  const safeName = name || "Loved one";
  const safeRelation = relation || safeName;

  if (weekdayMorningCheckInsComplete) {
    highlights.push(
      `${safeName} checked in every weekday morning before 10 AM.`,
    );
  }

  if (thinkingOfYou >= 1) {
    highlights.push(
      `You sent ${thinkingOfYou} 'Thinking of you' nudge${thinkingOfYou === 1 ? "" : "s"}.`,
    );
  }

  if (sosCount === 0) {
    highlights.push(`No emergencies — ${safeRelation} feels safe.`);
  }

  if (!highlights.length && checkIns > 0) {
    highlights.push(`${safeName} completed ${checkIns} check-in day${checkIns === 1 ? "" : "s"} this week.`);
  }

  return highlights;
};

const hadWeekdayMorningCheckIns = (completedCheckins, startDate, endDate) => {
  const weekdays = eachUtcDayInRange(startDate, endDate).filter((day) =>
    WEEKDAY_NAMES.has(getUtcWeekDayName(day)),
  );

  if (!weekdays.length) {
    return false;
  }

  const morningByDay = new Map();

  for (const entry of completedCheckins) {
    if (!entry.completedAt) {
      continue;
    }

    const completedAt = new Date(entry.completedAt);
    if (Number.isNaN(completedAt.getTime()) || completedAt.getUTCHours() >= 10) {
      continue;
    }

    const dayKey = getUtcStartOfDay(entry.date || completedAt).toISOString();
    morningByDay.set(dayKey, true);
  }

  return weekdays.every((day) => morningByDay.has(day.toISOString()));
};

const getWeeklyDigestService = async (currentUser, query = {}) => {
  const caregiverId = getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);
  const period = resolvePeriod(query);

  const [family, members] = await Promise.all([
    Family.findById(familyId).select("name"),
    User.find({
      familyId,
      role: "parent",
      ...ACTIVE_USER_FILTER,
    })
      .select(
        "_id name email relation image isEmailVerified lastInvitationTime familyInvitationCode",
      )
      .sort({ createdAt: 1 }),
  ]);

  const emptyFamily = {
    familyName: family?.name || null,
    memberCount: 0,
    activatedMemberCount: 0,
    cardTitle: "Family had a calm week ✨",
    stats: {
      checkIns: "0",
      medsOnTime: "0%",
      familyMessages: "0",
      thinkingOfYou: "0",
    },
    members: [],
  };

  if (!members.length) {
    return {
      period: {
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
      },
      person: null,
      family: emptyFamily,
    };
  }

  const memberIds = members.map((member) => member._id);
  const rangeFilter = {
    $gte: period.startDate,
    $lte: period.endDate,
  };

  const [
    checkinHistories,
    medications,
    medicationHistories,
    sosRecords,
    conversations,
  ] = await Promise.all([
    CheckinHistory.find({
      userId: { $in: memberIds },
      status: "completed",
      date: rangeFilter,
    }).select("userId date completedAt"),
    Medication.find({
      userId: { $in: memberIds },
      isActive: true,
    }).select(
      "userId frequency days dates startDate endDate isActive time",
    ),
    MedicationHistory.find({
      userId: { $in: memberIds },
      status: "taken",
      date: rangeFilter,
    }).select("userId"),
    Sos.find({
      userId: { $in: memberIds },
      createdAt: rangeFilter,
    }).select("userId"),
    Conversation.find({
      familyId,
      $or: [
        { type: "family" },
        { type: "individual", participants: { $in: memberIds } },
      ],
    }).select("_id type participants"),
  ]);

  const conversationIds = conversations.map((item) => item._id);
  const caregiverObjectId = new mongoose.Types.ObjectId(String(caregiverId));
  const [messageCounts, thinkingOfYouCounts] = await Promise.all([
    conversationIds.length
      ? Message.aggregate([
          {
            $match: {
              conversationId: { $in: conversationIds },
              createdAt: rangeFilter,
              deletedAt: null,
            },
          },
          {
            $group: {
              _id: "$conversationId",
              count: { $sum: 1 },
            },
          },
        ])
      : [],
    conversationIds.length
      ? Message.aggregate([
          {
            $match: {
              conversationId: { $in: conversationIds },
              senderId: caregiverObjectId,
              isThinkingOfYou: true,
              createdAt: rangeFilter,
              deletedAt: null,
            },
          },
          {
            $group: {
              _id: "$conversationId",
              count: { $sum: 1 },
            },
          },
        ])
      : [],
  ]);

  const messagesByConversationId = new Map(
    messageCounts.map((item) => [String(item._id), item.count]),
  );
  const thinkingByConversationId = new Map(
    thinkingOfYouCounts.map((item) => [String(item._id), item.count]),
  );

  const familyConversation = conversations.find(
    (item) => item.type === "family",
  );
  const familyConversationId = familyConversation
    ? String(familyConversation._id)
    : null;
  const familyMessageCount = familyConversationId
    ? messagesByConversationId.get(familyConversationId) || 0
    : 0;

  const checkinsByUserId = new Map();
  for (const entry of checkinHistories) {
    const key = String(entry.userId);
    if (!checkinsByUserId.has(key)) {
      checkinsByUserId.set(key, []);
    }
    checkinsByUserId.get(key).push(entry);
  }

  const medicationsByUserId = new Map();
  for (const medication of medications) {
    const key = String(medication.userId);
    if (!medicationsByUserId.has(key)) {
      medicationsByUserId.set(key, []);
    }
    medicationsByUserId.get(key).push(medication);
  }

  const takenByUserId = new Map();
  for (const entry of medicationHistories) {
    const key = String(entry.userId);
    takenByUserId.set(key, (takenByUserId.get(key) || 0) + 1);
  }

  const sosByUserId = new Map();
  for (const entry of sosRecords) {
    const key = String(entry.userId);
    sosByUserId.set(key, (sosByUserId.get(key) || 0) + 1);
  }

  const memberStatsList = members.map((member) => {
    const memberId = String(member._id);
    const invitation = buildInvitationDetails(member);
    const isActive = invitation.status === "activated";
    const memberCheckins = checkinsByUserId.get(memberId) || [];
    const uniqueCheckinDays = new Set(
      memberCheckins.map((item) => getUtcStartOfDay(item.date).toISOString()),
    );
    const checkIns = uniqueCheckinDays.size;
    const takenCount = takenByUserId.get(memberId) || 0;
    const scheduledCount = countScheduledMedicationDoses(
      medicationsByUserId.get(memberId) || [],
      period.startDate,
      period.endDate,
    );
    const sosCount = sosByUserId.get(memberId) || 0;

    const individualConversations = conversations.filter(
      (item) =>
        item.type === "individual" &&
        (item.participants || []).some(
          (participantId) => String(participantId) === memberId,
        ),
    );

    let individualMessages = 0;
    let individualThinking = 0;
    for (const conversation of individualConversations) {
      const conversationId = String(conversation._id);
      individualMessages += messagesByConversationId.get(conversationId) || 0;
      individualThinking += thinkingByConversationId.get(conversationId) || 0;
    }

    const familyMessages = individualMessages + familyMessageCount;
    // Attribute thinking-of-you nudges to the loved one via their individual chats only.
    const thinkingOfYou = individualThinking;
    const weekdayMorningCheckInsComplete = hadWeekdayMorningCheckIns(
      memberCheckins,
      period.startDate,
      period.endDate,
    );

    const stats = {
      checkIns: toDisplayCount(checkIns),
      medsOnTime: `${takenCount}/${scheduledCount}`,
      familyMessages: toDisplayCount(familyMessages),
      thinkingOfYou: toDisplayCount(thinkingOfYou),
      sosCount: toDisplayCount(sosCount),
    };

    return {
      memberId,
      name: member.name || "",
      relation: member.relation || null,
      email: member.email || null,
      image: member.image || null,
      isActive,
      stats,
      _raw: {
        checkIns,
        takenCount,
        scheduledCount,
        familyMessages,
        thinkingOfYou,
        sosCount,
        weekdayMorningCheckInsComplete,
      },
    };
  });

  const activatedMembers = memberStatsList.filter((item) => item.isActive);

  let selectedMember = null;
  if (query.memberId) {
    selectedMember = memberStatsList.find(
      (item) => item.memberId === String(query.memberId),
    );
    if (!selectedMember) {
      throw new CustomError("You do not have access to this member", [], 403);
    }
  } else {
    selectedMember =
      activatedMembers[0] || memberStatsList[0] || null;
  }

  const person = selectedMember
    ? {
        memberId: selectedMember.memberId,
        name: selectedMember.name,
        relation: selectedMember.relation,
        email: selectedMember.email,
        image: selectedMember.image,
        cardTitle: buildPersonCardTitle(selectedMember.name),
        stats: selectedMember.stats,
        highlights: buildHighlights({
          name: selectedMember.name,
          relation: selectedMember.relation,
          checkIns: selectedMember._raw.checkIns,
          thinkingOfYou: selectedMember._raw.thinkingOfYou,
          sosCount: selectedMember._raw.sosCount,
          weekdayMorningCheckInsComplete:
            selectedMember._raw.weekdayMorningCheckInsComplete,
        }),
      }
    : null;

  const rollupSource = activatedMembers.length
    ? activatedMembers
    : [];

  const rollupCheckIns = rollupSource.reduce(
    (sum, item) => sum + item._raw.checkIns,
    0,
  );
  const rollupMessages = rollupSource.reduce(
    (sum, item) => sum + item._raw.familyMessages,
    0,
  );
  const rollupThinking = rollupSource.reduce(
    (sum, item) => sum + item._raw.thinkingOfYou,
    0,
  );
  const rollupTaken = rollupSource.reduce(
    (sum, item) => sum + item._raw.takenCount,
    0,
  );
  const rollupScheduled = rollupSource.reduce(
    (sum, item) => sum + item._raw.scheduledCount,
    0,
  );
  const rollupSos = rollupSource.reduce(
    (sum, item) => sum + item._raw.sosCount,
    0,
  );

  const adherencePercents = rollupSource
    .map((item) => {
      if (!item._raw.scheduledCount) {
        return null;
      }
      return (item._raw.takenCount / item._raw.scheduledCount) * 100;
    })
    .filter((value) => value !== null);

  const averageAdherence = adherencePercents.length
    ? Math.round(
        adherencePercents.reduce((sum, value) => sum + value, 0) /
          adherencePercents.length,
      )
    : rollupScheduled > 0
      ? Math.round((rollupTaken / rollupScheduled) * 100)
      : 0;

  return {
    period: {
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
    },
    person,
    family: {
      familyName: family?.name || null,
      memberCount: memberStatsList.length,
      activatedMemberCount: activatedMembers.length,
      cardTitle: buildFamilyCardTitle(rollupSos),
      stats: {
        checkIns: toDisplayCount(rollupCheckIns),
        medsOnTime: `${averageAdherence}%`,
        familyMessages: toDisplayCount(rollupMessages),
        thinkingOfYou: toDisplayCount(rollupThinking),
      },
      members: memberStatsList.map(
        ({ memberId, name, relation, email, image, isActive, stats }) => ({
          memberId,
          name,
          relation,
          email,
          image,
          isActive,
          stats,
        }),
      ),
    },
  };
};

module.exports = {
  getWeeklyDigestService,
  resolvePeriod,
};
