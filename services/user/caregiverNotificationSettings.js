const ProfileSetting = require("../../models/profileSetting");

const NOTIFICATION_SETTING_KEYS = [
  "sosAlerts",
  "missedCheckIns",
  "missedMedications",
  "newFamilyMessages",
  "weeklyDigest",
];

const buildNotificationSettingsResponse = (profileSetting) => {
  return {
    sosAlerts: profileSetting?.sosAlerts ?? true,
    missedCheckIns: profileSetting?.missedCheckIns ?? true,
    missedMedications: profileSetting?.missedMedications ?? true,
    newFamilyMessages: profileSetting?.newFamilyMessages ?? true,
    weeklyDigest: profileSetting?.weeklyDigest ?? true,
  };
};

const createCaregiverProfileSetting = async (userId) => {
  return ProfileSetting.create({ userId });
};

const getOrCreateCaregiverProfileSetting = async (userId) => {
  let profileSetting = await ProfileSetting.findOne({ userId });

  if (!profileSetting) {
    profileSetting = await createCaregiverProfileSetting(userId);
  }

  return profileSetting;
};

const appendCaregiverNotificationSettings = async (user, userData) => {
  if (user?.role !== "caregiver") {
    return userData;
  }

  const profileSetting = await getOrCreateCaregiverProfileSetting(user._id);

  return {
    ...userData,
    notificationSettings: buildNotificationSettingsResponse(profileSetting),
  };
};

const extractNotificationSettingUpdates = (payload = {}) => {
  const source =
    payload.notificationSettings &&
    typeof payload.notificationSettings === "object"
      ? payload.notificationSettings
      : payload;

  return NOTIFICATION_SETTING_KEYS.reduce((updates, key) => {
    if (source[key] !== undefined) {
      updates[key] = Boolean(source[key]);
    }

    return updates;
  }, {});
};

module.exports = {
  NOTIFICATION_SETTING_KEYS,
  buildNotificationSettingsResponse,
  createCaregiverProfileSetting,
  getOrCreateCaregiverProfileSetting,
  appendCaregiverNotificationSettings,
  extractNotificationSettingUpdates,
};
