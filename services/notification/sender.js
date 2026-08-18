const User = require("../../models/user");
const { sendMulticast } = require("./fcm");
const { removeFcmTokenFromUser } = require("../auth/fcmToken");
const notificationConfig = require("../../config/notification");
const { logNotificationEvent } = require("../../utils/notificationLogger");

const INVALID_TOKEN_ERRORS = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const normalizeDataPayload = (data = {}) => {
  return Object.entries(data).reduce((accumulator, [key, value]) => {
    if (value === undefined || value === null) {
      return accumulator;
    }
    accumulator[key] = String(value);
    return accumulator;
  }, {});
};

const sendNotificationToUser = async ({
  userId,
  title,
  body,
  data,
  notificationId,
}) => {
  const user = await User.findById(userId).select("fcmTokens");
  const tokens = Array.isArray(user?.fcmTokens)
    ? user.fcmTokens.filter(Boolean)
    : [];

  if (tokens.length === 0) {
    logNotificationEvent("notification_no_tokens", {
      notificationId,
      userId: String(userId),
    });
    return {
      delivered: false,
      reason: "no_tokens",
      invalidTokens: [],
    };
  }

  const chunks = chunkArray(tokens, notificationConfig.fcmMulticastBatchSize);
  let successCount = 0;
  const invalidTokens = [];

  for (const tokenChunk of chunks) {
    const response = await sendMulticast({
      tokens: tokenChunk,
      title,
      body,
      data: normalizeDataPayload(data),
    });

    successCount += response.successCount || 0;

    (response.responses || []).forEach((item, index) => {
      if (item.success) {
        return;
      }

      const errorCode = item.error?.code;
      if (errorCode && INVALID_TOKEN_ERRORS.has(errorCode)) {
        invalidTokens.push(tokenChunk[index]);
      }
    });
  }

  if (invalidTokens.length > 0 && user) {
    for (const token of invalidTokens) {
      removeFcmTokenFromUser(user, token);
    }
    await user.save();
    logNotificationEvent("notification_invalid_tokens_removed", {
      notificationId,
      userId: String(userId),
      count: invalidTokens.length,
    });
  }

  return {
    delivered: successCount > 0,
    successCount,
    invalidTokens,
  };
};

const isRetryableError = (error) => {
  const code = error?.code || error?.errorInfo?.code || "";
  if (INVALID_TOKEN_ERRORS.has(code)) {
    return false;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("unavailable") ||
    message.includes("internal") ||
    message.includes("network")
  );
};

module.exports = {
  sendNotificationToUser,
  isRetryableError,
  INVALID_TOKEN_ERRORS,
};
