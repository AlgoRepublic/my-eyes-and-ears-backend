const User = require("../../models/user");
const ProfileSetting = require("../../models/profileSetting");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const CAREGIVER_PREF_BY_TYPE = {
  medication: "missedMedications",
  appointment: null,
  checkinReminder: "missedCheckIns",
  sos: "sosAlerts",
};

const PARENT_PREF_BY_TYPE = {
  medication: "medicationReminders",
  appointment: "appointmentsReminders",
  checkinReminder: "dailyCheckInReminders",
  sos: null,
};

const isNotificationEnabledForUser = (
  profileSetting,
  type,
  role,
  { bypassDoNotDisturb = false } = {},
) => {
  if (!profileSetting) {
    return false;
  }

  if (!bypassDoNotDisturb && profileSetting.doNotDisturb) {
    return false;
  }

  if (role === "parent") {
    const prefKey = PARENT_PREF_BY_TYPE[type];
    return prefKey ? profileSetting[prefKey] !== false : true;
  }

  if (role === "caregiver") {
    const prefKey = CAREGIVER_PREF_BY_TYPE[type];
    return prefKey ? profileSetting[prefKey] !== false : true;
  }

  return false;
};

const getNotificationRecipients = async ({
  parentUserId,
  type,
  includeCaregivers = true,
  bypassDoNotDisturb = false,
}) => {
  const parentUser = await User.findOne({
    _id: parentUserId,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  }).select("_id familyId role");

  if (!parentUser) {
    return [];
  }

  const userIds = [parentUser._id];
  let caregivers = [];

  if (includeCaregivers && parentUser.familyId) {
    caregivers = await User.find({
      familyId: parentUser.familyId,
      role: "caregiver",
      ...ACTIVE_USER_FILTER,
    }).select("_id role");
    userIds.push(...caregivers.map((item) => item._id));
  }

  const profileSettings = await ProfileSetting.find({
    userId: { $in: userIds },
  }).lean();

  const profileByUserId = profileSettings.reduce((accumulator, item) => {
    accumulator.set(String(item.userId), item);
    return accumulator;
  }, new Map());

  const preferenceOptions = { bypassDoNotDisturb };

  const recipients = [
    {
      userId: parentUser._id,
      role: "parent",
      enabled: isNotificationEnabledForUser(
        profileByUserId.get(String(parentUser._id)),
        type,
        "parent",
        preferenceOptions,
      ),
    },
  ];

  for (const caregiver of caregivers) {
    recipients.push({
      userId: caregiver._id,
      role: "caregiver",
      enabled: isNotificationEnabledForUser(
        profileByUserId.get(String(caregiver._id)),
        type,
        "caregiver",
        preferenceOptions,
      ),
    });
  }

  return recipients.filter((item) => item.enabled);
};

module.exports = {
  getNotificationRecipients,
  isNotificationEnabledForUser,
};
