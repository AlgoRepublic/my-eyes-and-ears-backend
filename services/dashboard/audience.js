const User = require("../../models/user");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const getDashboardAudienceForParent = async (parentUserId) => {
  const parentUser = await User.findOne({
    _id: parentUserId,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  }).select("_id familyId");

  if (!parentUser) {
    return [];
  }

  const audience = [String(parentUser._id)];

  if (parentUser.familyId) {
    const caregivers = await User.find({
      familyId: parentUser.familyId,
      role: "caregiver",
      ...ACTIVE_USER_FILTER,
    }).select("_id");

    audience.push(...caregivers.map((caregiver) => String(caregiver._id)));
  }

  return [...new Set(audience)];
};

module.exports = {
  getDashboardAudienceForParent,
};
