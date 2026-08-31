const User = require("../../models/user");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { buildMembersListResponse } = require("./buildMembersListResponse");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const {
  getConversationSummariesForMembers,
} = require("../chat/conversations");

const getMembersService = async (currentUser) => {
  getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);

  const members = await User.find({
    familyId,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  }).sort({ createdAt: 1 });

  const membersResponse = await buildMembersListResponse(members);
  const { familyConversation, individualConversationsByMemberId } =
    await getConversationSummariesForMembers(currentUser, members);

  return {
    familyConversation,
    members: membersResponse.map((member) => ({
      ...member,
      familyConversation,
      individualConversation:
        individualConversationsByMemberId.get(String(member.id)) || null,
    })),
  };
};

module.exports = {
  getMembersService,
};
