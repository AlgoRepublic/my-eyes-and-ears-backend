const normalizeFcmToken = (token) => {
  const normalized = String(token || "").trim();
  return normalized || null;
};

const addFcmTokenToUser = (user, token) => {
  const normalizedToken = normalizeFcmToken(token);
  if (!normalizedToken || !user) return false;

  const existingTokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];
  if (existingTokens.includes(normalizedToken)) {
    user.fcmTokens = existingTokens;
    return false;
  }

  user.fcmTokens = [...existingTokens, normalizedToken];
  return true;
};

const removeFcmTokenFromUser = (user, token) => {
  const normalizedToken = normalizeFcmToken(token);
  if (!normalizedToken || !user) return false;

  const existingTokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];
  const updatedTokens = existingTokens.filter(
    (item) => item !== normalizedToken,
  );
  const removed = updatedTokens.length !== existingTokens.length;

  if (removed) {
    user.fcmTokens = updatedTokens;
  }

  return removed;
};

module.exports = {
  normalizeFcmToken,
  addFcmTokenToUser,
  removeFcmTokenFromUser,
};
