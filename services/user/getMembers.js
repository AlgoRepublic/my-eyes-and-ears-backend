const User = require("../../models/user");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { buildMembersListResponse } = require("./buildMembersListResponse");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const getMembersService = async (currentUser) => {
  getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);

  const members = await User.find({
    familyId,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  }).sort({ createdAt: 1 });

  return {
    members: await buildMembersListResponse(members),
  };
};

module.exports = {
  getMembersService,
};
