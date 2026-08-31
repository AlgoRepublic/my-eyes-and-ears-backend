const mongoose = require("mongoose");
const User = require("../../models/user");
const Conversation = require("../../models/conversation");
const ConversationParticipant = require("../../models/conversationParticipant");
const Message = require("../../models/message");
const { CustomError } = require("../../utils/error");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const {
  getCurrentUserId,
  resolveUserFamilyIdOrThrow,
  ensureFamilyMemberOrThrow,
  buildIndividualConversationKey,
  ensureConversationAccessOrThrow,
  mapMinimalUser,
} = require("./chatAccess");
const { formatLastMessage } = require("./formatMessage");

const getFamilyMemberUsers = async (familyId) =>
  User.find({
    familyId,
    ...ACTIVE_USER_FILTER,
  }).select("_id name email role relation image familyId");

const createParticipantRecords = async (conversationId, userIds) => {
  const docs = userIds.map((userId) => ({
    conversationId,
    userId,
    unreadCount: 0,
    joinedAt: new Date(),
  }));

  for (const doc of docs) {
    try {
      await ConversationParticipant.create(doc);
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }
};

const ensureFamilyConversation = async (familyId, createdBy) => {
  let conversation = await Conversation.findOne({
    familyId,
    type: "family",
  });

  if (conversation) {
    return conversation;
  }

  const members = await getFamilyMemberUsers(familyId);
  const participantIds = members.map((member) => member._id);

  try {
    conversation = await Conversation.create({
      familyId,
      type: "family",
      participants: participantIds,
      createdBy,
    });
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    conversation = await Conversation.findOne({
      familyId,
      type: "family",
    });
  }

  if (conversation) {
    await createParticipantRecords(conversation._id, participantIds);
  }

  return conversation;
};

const syncFamilyConversationParticipants = async (conversation) => {
  const members = await getFamilyMemberUsers(conversation.familyId);
  const memberIds = members.map((member) => member._id);
  const memberIdSet = new Set(memberIds.map(String));

  const existingParticipants = await ConversationParticipant.find({
    conversationId: conversation._id,
  }).select("userId");

  const existingIds = new Set(
    existingParticipants.map((item) => String(item.userId)),
  );
  const missingIds = memberIds.filter((id) => !existingIds.has(String(id)));

  if (missingIds.length) {
    await createParticipantRecords(conversation._id, missingIds);
    await Conversation.updateOne(
      { _id: conversation._id },
      { $addToSet: { participants: { $each: missingIds } } },
    );
  }

  return members.filter((member) => memberIdSet.has(String(member._id)));
};

const buildIndividualConversationResponse = async ({
  conversation,
  participantRecord,
  currentUserId,
  usersById,
  lastMessage,
}) => {
  const otherParticipantId = conversation.participants.find(
    (id) => String(id) !== String(currentUserId),
  );
  const otherUser = usersById.get(String(otherParticipantId));

  return {
    conversationId: conversation._id,
    type: conversation.type,
    user: mapMinimalUser(otherUser),
    lastMessage: formatLastMessage(
      lastMessage,
      lastMessage ? usersById.get(String(lastMessage.senderId)) : null,
    ),
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: participantRecord?.unreadCount ?? 0,
    hasUnread: (participantRecord?.unreadCount ?? 0) > 0,
  };
};

const buildFamilyConversationResponse = ({
  conversation,
  participantRecord,
  lastMessage,
  usersById,
}) => ({
  conversationId: conversation._id,
  type: conversation.type,
  name: "Family Group",
  lastMessage: formatLastMessage(
    lastMessage,
    lastMessage ? usersById.get(String(lastMessage.senderId)) : null,
  ),
  lastMessageAt: conversation.lastMessageAt,
  unreadCount: participantRecord?.unreadCount ?? 0,
  hasUnread: (participantRecord?.unreadCount ?? 0) > 0,
});

const buildPlaceholderIndividualConversation = (memberUser) => ({
  conversationId: null,
  type: "individual",
  user: mapMinimalUser(memberUser),
  lastMessage: null,
  lastMessageAt: null,
  unreadCount: 0,
  hasUnread: false,
});

const getConversationSummariesForMembers = async (
  currentUser,
  memberUsers = [],
) => {
  const familyId = await resolveUserFamilyIdOrThrow(currentUser);
  const currentUserId = getCurrentUserId(currentUser);
  const normalizedMembers = Array.isArray(memberUsers) ? memberUsers : [];

  const familyConversationDoc = await ensureFamilyConversation(
    familyId,
    currentUserId,
  );
  await syncFamilyConversationParticipants(familyConversationDoc);

  const allUsers = await getFamilyMemberUsers(familyId);
  const usersById = allUsers.reduce((accumulator, item) => {
    accumulator.set(String(item._id), item);
    return accumulator;
  }, new Map());

  const individualKeys = normalizedMembers.map((member) =>
    buildIndividualConversationKey(familyId, currentUserId, member._id),
  );

  const individualConversations = individualKeys.length
    ? await Conversation.find({
        familyId,
        type: "individual",
        individualKey: { $in: individualKeys },
      })
    : [];

  const conversationIds = [
    familyConversationDoc._id,
    ...individualConversations.map((item) => item._id),
  ];

  const [participantRecords, conversationsWithMessages] = await Promise.all([
    ConversationParticipant.find({
      userId: currentUserId,
      conversationId: { $in: conversationIds },
    }).select("conversationId unreadCount"),
    Promise.all(
      [familyConversationDoc, ...individualConversations].map(
        async (conversation) => {
          const lastMessage = conversation.lastMessageId
            ? await Message.findById(conversation.lastMessageId)
            : null;
          return { conversation, lastMessage };
        },
      ),
    ),
  ]);

  const participantByConversationId = participantRecords.reduce(
    (accumulator, item) => {
      accumulator.set(String(item.conversationId), item);
      return accumulator;
    },
    new Map(),
  );

  const conversationDataById = conversationsWithMessages.reduce(
    (accumulator, item) => {
      accumulator.set(String(item.conversation._id), item);
      return accumulator;
    },
    new Map(),
  );

  const familyConversationData = conversationDataById.get(
    String(familyConversationDoc._id),
  );

  const familyConversation = buildFamilyConversationResponse({
    conversation: familyConversationDoc,
    participantRecord: participantByConversationId.get(
      String(familyConversationDoc._id),
    ),
    lastMessage: familyConversationData?.lastMessage ?? null,
    usersById,
  });

  const individualConversationByKey = individualConversations.reduce(
    (accumulator, conversation) => {
      accumulator.set(conversation.individualKey, conversation);
      return accumulator;
    },
    new Map(),
  );

  const individualConversationsByMemberId = new Map();

  for (const member of normalizedMembers) {
    const individualKey = buildIndividualConversationKey(
      familyId,
      currentUserId,
      member._id,
    );
    const conversation = individualConversationByKey.get(individualKey);

    if (!conversation) {
      individualConversationsByMemberId.set(
        String(member._id),
        buildPlaceholderIndividualConversation(member),
      );
      continue;
    }

    const conversationData = conversationDataById.get(String(conversation._id));
    individualConversationsByMemberId.set(
      String(member._id),
      await buildIndividualConversationResponse({
        conversation,
        participantRecord: participantByConversationId.get(
          String(conversation._id),
        ),
        currentUserId,
        usersById,
        lastMessage: conversationData?.lastMessage ?? null,
      }),
    );
  }

  return {
    familyConversation,
    individualConversationsByMemberId,
  };
};

const listConversationsService = async (currentUser) => {
  const familyId = await resolveUserFamilyIdOrThrow(currentUser);
  const currentUserId = getCurrentUserId(currentUser);

  const familyConversation = await ensureFamilyConversation(
    familyId,
    currentUserId,
  );
  await syncFamilyConversationParticipants(familyConversation);

  const participantRecords = await ConversationParticipant.find({
    userId: currentUserId,
  }).select("conversationId unreadCount lastReadMessageId lastReadAt muted");

  const conversationIds = participantRecords.map((item) => item.conversationId);

  if (!conversationIds.length) {
    return [];
  }

  const conversations = await Conversation.find({
    _id: { $in: conversationIds },
    familyId,
  }).sort({ lastMessageAt: -1, updatedAt: -1 });

  const lastMessageIds = conversations
    .map((item) => item.lastMessageId)
    .filter(Boolean);

  const [lastMessages, allUsers] = await Promise.all([
    lastMessageIds.length ? Message.find({ _id: { $in: lastMessageIds } }) : [],
    getFamilyMemberUsers(familyId),
  ]);

  const lastMessageById = lastMessages.reduce((accumulator, item) => {
    accumulator.set(String(item._id), item);
    return accumulator;
  }, new Map());

  const participantByConversationId = participantRecords.reduce(
    (accumulator, item) => {
      accumulator.set(String(item.conversationId), item);
      return accumulator;
    },
    new Map(),
  );

  const usersById = allUsers.reduce((accumulator, item) => {
    accumulator.set(String(item._id), item);
    return accumulator;
  }, new Map());

  const items = [];
  const conversationMemberIds = new Set();

  for (const conversation of conversations) {
    const participantRecord = participantByConversationId.get(
      String(conversation._id),
    );
    const lastMessage = conversation.lastMessageId
      ? lastMessageById.get(String(conversation.lastMessageId))
      : null;

    if (conversation.type === "family") {
      items.push(
        buildFamilyConversationResponse({
          conversation,
          participantRecord,
          lastMessage,
          usersById,
        }),
      );
      continue;
    }

    conversationMemberIds.add(
      String(
        conversation.participants.find(
          (id) => String(id) !== String(currentUserId),
        ),
      ),
    );
    items.push(
      await buildIndividualConversationResponse({
        conversation,
        participantRecord,
        currentUserId,
        usersById,
        lastMessage,
      }),
    );
  }

  for (const member of allUsers) {
    if (
      String(member._id) === String(currentUserId) ||
      conversationMemberIds.has(String(member._id))
    ) {
      continue;
    }

    items.push({
      conversationId: null,
      type: "individual",
      user: mapMinimalUser(member),
      lastMessage: null,
      lastMessageAt: null,
      unreadCount: 0,
      hasUnread: false,
    });
  }
  //
  return items.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
};

const getConversationDetailService = async (currentUser, conversationId) => {
  const { conversation, participant, currentUserId } =
    await ensureConversationAccessOrThrow(currentUser, conversationId);

  let detail = {
    conversationId: conversation._id,
    type: conversation.type,
    familyId: conversation.familyId,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: participant.unreadCount ?? 0,
    hasUnread: (participant.unreadCount ?? 0) > 0,
    muted: participant.muted ?? false,
  };

  if (conversation.type === "family") {
    detail.name = "Family Group";
    return detail;
  }

  const otherParticipantId = conversation.participants.find(
    (id) => String(id) !== String(currentUserId),
  );
  const otherUser = await User.findOne({
    _id: otherParticipantId,
    ...ACTIVE_USER_FILTER,
  }).select("_id name email role relation image");

  detail.user = mapMinimalUser(otherUser);
  return detail;
};

const getOrCreateIndividualConversationService = async (
  currentUser,
  targetUserId,
) => {
  const { familyId, targetUser } = await ensureFamilyMemberOrThrow(
    currentUser,
    targetUserId,
  );
  const currentUserId = getCurrentUserId(currentUser);
  const individualKey = buildIndividualConversationKey(
    familyId,
    currentUserId,
    targetUser._id,
  );

  let conversation = await Conversation.findOne({
    familyId,
    type: "individual",
    individualKey,
  });

  if (!conversation) {
    const participantIds = [currentUserId, targetUser._id];

    try {
      conversation = await Conversation.create({
        familyId,
        type: "individual",
        participants: participantIds,
        individualKey,
        createdBy: currentUserId,
      });
      await createParticipantRecords(conversation._id, participantIds);
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      conversation = await Conversation.findOne({
        familyId,
        type: "individual",
        individualKey,
      });
    }
  }

  if (!conversation) {
    throw new CustomError("Unable to create conversation", [], 500);
  }

  await createParticipantRecords(conversation._id, [
    currentUserId,
    targetUser._id,
  ]);

  const participantRecord = await ConversationParticipant.findOne({
    conversationId: conversation._id,
    userId: currentUserId,
  });

  return {
    conversationId: conversation._id,
    type: conversation.type,
    user: mapMinimalUser(targetUser),
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: participantRecord?.unreadCount ?? 0,
    hasUnread: (participantRecord?.unreadCount ?? 0) > 0,
  };
};

const getTotalUnreadCountService = async (currentUser) => {
  const currentUserId = getCurrentUserId(currentUser);
  const result = await ConversationParticipant.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(currentUserId)) } },
    { $group: { _id: null, totalUnread: { $sum: "$unreadCount" } } },
  ]);

  return {
    unreadCount: result[0]?.totalUnread ?? 0,
  };
};

module.exports = {
  ensureFamilyConversation,
  listConversationsService,
  getConversationDetailService,
  getOrCreateIndividualConversationService,
  getTotalUnreadCountService,
  getConversationSummariesForMembers,
  getFamilyMemberUsers,
};
