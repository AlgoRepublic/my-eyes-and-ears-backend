const User = require("../../models/user");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { buildMembersListResponse } = require("./buildMembersListResponse");

const getMembersService = async (currentUser) => {
  getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);

  const members = await User.find({
    familyId,
    role: "parent",
  }).sort({ createdAt: 1 });

  return {
    members: await buildMembersListResponse(members),
  };
};

module.exports = {
  getMembersService,
};
