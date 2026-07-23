const ACTIVE_USER_FILTER = { isDeleted: { $ne: true } };

const appendDeletedSuffix = (value, userId) => {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  return `${normalized}_deleted_${userId}`;
};

const applySoftDeleteFields = (user) => {
  const userId = String(user._id);

  user.isDeleted = true;

  if (user.email) {
    user.email = appendDeletedSuffix(user.email, userId);
  }

  if (user.phoneNumber) {
    user.phoneNumber = appendDeletedSuffix(user.phoneNumber, userId);
  }

  if (user.familyInvitationCode) {
    user.familyInvitationCode = appendDeletedSuffix(
      user.familyInvitationCode,
      userId,
    ).toUpperCase();
  }

  user.fcmTokens = [];

  return user;
};

const softDeleteUser = async (user) => {
  applySoftDeleteFields(user);
  await user.save();
  return user;
};

const mergeActiveUserFilter = (filter = {}) => {
  return {
    ...filter,
    ...ACTIVE_USER_FILTER,
  };
};

module.exports = {
  ACTIVE_USER_FILTER,
  appendDeletedSuffix,
  applySoftDeleteFields,
  softDeleteUser,
  mergeActiveUserFilter,
};
