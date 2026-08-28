const mongoose = require("mongoose");
const User = require("../../models/user");
const Conversation = require("../../models/conversation");
const ConversationParticipant = require("../../models/conversationParticipant");
const { CustomError } = require("../../utils/error");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const getCurrentUserId = (currentUser) => currentUser?._id || currentUser?.id;

const ensureObjectIdOrThrow = (value, fieldName) => {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new CustomError(`${fieldName} is required`, [], 400);
  }

  if (!mongoose.Types.ObjectId.isValid(normalized)) {
    throw new CustomError(`Invalid ${fieldName}`, [], 400);
  }

  return normalized;
};

const resolveUserFamilyIdOrThrow = async (currentUser) => {
  if (!currentUser) {
    throw new CustomError("Authenticated user is required", [], 401);
  }

  if (currentUser.role === "caregiver") {
    return getFamilyIdOrThrow(currentUser);
  }

  if (!currentUser.familyId) {
    throw new CustomError("User is not part of a family", [], 403);
  }

  return currentUser.familyId;
};

const ensureFamilyMemberOrThrow = async (currentUser, targetUserId) => {
  const familyId = await resolveUserFamilyIdOrThrow(currentUser);
  const normalizedTargetUserId = ensureObjectIdOrThrow(targetUserId, "userId");
  const currentUserId = String(getCurrentUserId(currentUser));

  if (currentUserId === String(normalizedTargetUserId)) {
    throw new CustomError("Cannot start a chat with yourself", [], 400);
  }

  const targetUser = await User.findOne({
    _id: normalizedTargetUserId,
    familyId,
    ...ACTIVE_USER_FILTER,
  }).select("_id name email role relation image familyId");

  if (!targetUser) {
    throw new CustomError("Family member not found", [], 404);
  }

  return { familyId, targetUser };
};

const buildIndividualConversationKey = (familyId, userIdA, userIdB) => {
  const ids = [String(userIdA), String(userIdB)].sort();
  return `${String(familyId)}:${ids[0]}:${ids[1]}`;
};

const ensureConversationAccessOrThrow = async (currentUser, conversationId) => {
  const normalizedConversationId = ensureObjectIdOrThrow(
    conversationId,
    "conversationId",
  );
  const familyId = await resolveUserFamilyIdOrThrow(currentUser);
  const currentUserId = getCurrentUserId(currentUser);

  const conversation = await Conversation.findOne({
    _id: normalizedConversationId,
    familyId,
  });

  if (!conversation) {
    throw new CustomError("Conversation not found", [], 404);
  }

  const participant = await ConversationParticipant.findOne({
    conversationId: conversation._id,
    userId: currentUserId,
  });

  if (!participant) {
    throw new CustomError("You do not have access to this conversation", [], 403);
  }

  return { conversation, participant, familyId, currentUserId };
};

const mapMinimalUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user._id || user.id,
    name: user.name,
    role: user.role,
    email: user.email ?? null,
    relationship: user.relation ?? null,
    profileImage: user.image ?? null,
  };
};

module.exports = {
  getCurrentUserId,
  ensureObjectIdOrThrow,
  resolveUserFamilyIdOrThrow,
  ensureFamilyMemberOrThrow,
  buildIndividualConversationKey,
  ensureConversationAccessOrThrow,
  mapMinimalUser,
};
