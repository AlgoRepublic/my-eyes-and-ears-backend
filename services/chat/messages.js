const mongoose = require("mongoose");
const Message = require("../../models/message");
const Conversation = require("../../models/conversation");
const ConversationParticipant = require("../../models/conversationParticipant");
const User = require("../../models/user");
const chatConfig = require("../../config/chat");
const { CustomError } = require("../../utils/error");
const {
  saveChatAttachment,
} = require("../../utils/chatAttachmentStorage");
const {
  getCurrentUserId,
  ensureObjectIdOrThrow,
  ensureConversationAccessOrThrow,
} = require("./chatAccess");
const { formatMessage } = require("./formatMessage");
const { queueChatNotifications } = require("./notifications");

const ATTACHMENT_MESSAGE_TYPES = new Set(["image", "video", "audio", "file"]);

const validateSendMessagePayload = async (payload = {}, { attachmentFile, userId } = {}) => {
  const clientMessageId = String(payload.clientMessageId || "").trim();
  const type = String(payload.type || "").trim();

  if (!clientMessageId) {
    throw new CustomError("clientMessageId is required", [], 400);
  }

  if (!chatConfig.MESSAGE_TYPES.includes(type)) {
    throw new CustomError("Invalid message type", [], 400);
  }

  if (type === "text") {
    const text = String(payload.text || "").trim();
    if (!text) {
      throw new CustomError("Message text is required", [], 400);
    }
    return { clientMessageId, type, text };
  }

  if (!ATTACHMENT_MESSAGE_TYPES.has(type)) {
    throw new CustomError("Invalid message type", [], 400);
  }

  if (!attachmentFile) {
    throw new CustomError("Attachment file is required", [], 400);
  }

  const savedAttachment = await saveChatAttachment(attachmentFile, userId, type);
  const duration = payload.duration ? Number(payload.duration) : null;

  return {
    clientMessageId,
    type,
    text: payload.text ? String(payload.text).trim() : null,
    attachment: {
      ...savedAttachment,
      duration: Number.isFinite(duration) && duration > 0 ? duration : null,
      thumbnailUrl: null,
    },
    replyToMessageId: payload.replyToMessageId ?? null,
  };
};

const findExistingMessageByClientId = async ({
  conversationId,
  senderId,
  clientMessageId,
}) =>
  Message.findOne({
    conversationId,
    senderId,
    clientMessageId,
  });

const getMessageSender = (senderId) =>
  User.findById(senderId).select("_id name email role relation image");

const incrementUnreadForRecipients = async ({
  conversationId,
  senderId,
  messageId,
}) => {
  await ConversationParticipant.updateMany(
    {
      conversationId,
      userId: { $ne: senderId },
    },
    {
      $inc: { unreadCount: 1 },
      $set: { updatedAt: new Date() },
    },
  );

  return ConversationParticipant.find({
    conversationId,
    userId: { $ne: senderId },
  }).select("userId muted");
};

const broadcastConversationUpdated = (io, conversationId, payload) => {
  if (!io) {
    return;
  }

  io.to(`conversation:${conversationId}`).emit("conversation:updated", payload);
};

const sendMessageService = async (
  currentUser,
  conversationId,
  payload,
  { io, files } = {},
) => {
  const { conversation, currentUserId } = await ensureConversationAccessOrThrow(
    currentUser,
    conversationId,
  );
  const attachmentFile = Array.isArray(files)
    ? files.find((file) => file.fieldname === "attachment")
    : null;
  const normalizedPayload = await validateSendMessagePayload(payload, {
    attachmentFile,
    userId: currentUserId,
  });

  const existing = await findExistingMessageByClientId({
    conversationId: conversation._id,
    senderId: currentUserId,
    clientMessageId: normalizedPayload.clientMessageId,
  });

  if (existing) {
    return formatMessage(existing, await getMessageSender(existing.senderId));
  }

  if (normalizedPayload.replyToMessageId) {
    const replyMessage = await Message.findOne({
      _id: normalizedPayload.replyToMessageId,
      conversationId: conversation._id,
      deletedAt: null,
    });

    if (!replyMessage) {
      throw new CustomError("Reply message not found", [], 404);
    }
  }

  let message;

  try {
    message = await Message.create({
      conversationId: conversation._id,
      senderId: currentUserId,
      ...normalizedPayload,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await findExistingMessageByClientId({
        conversationId: conversation._id,
        senderId: currentUserId,
        clientMessageId: normalizedPayload.clientMessageId,
      });
      if (duplicate) {
        return formatMessage(
          duplicate,
          await getMessageSender(duplicate.senderId),
        );
      }
    }
    throw error;
  }

  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        lastMessageId: message._id,
        lastMessageAt: message.createdAt,
        updatedAt: new Date(),
      },
    },
  );

  const recipientParticipants = await incrementUnreadForRecipients({
    conversationId: conversation._id,
    senderId: currentUserId,
    messageId: message._id,
  });

  const sender = await getMessageSender(currentUserId);
  const formattedMessage = formatMessage(message, sender);

  if (io) {
    io.to(`conversation:${conversation._id}`).emit(
      "message:new",
      formattedMessage,
    );
    broadcastConversationUpdated(io, conversation._id, {
      conversationId: conversation._id,
      lastMessage: {
        _id: message._id,
        type: message.type,
        text: message.text,
        senderId: message.senderId,
        createdAt: message.createdAt,
      },
      lastMessageAt: message.createdAt,
    });
  }

  const mutedUserIds = new Set(
    recipientParticipants
      .filter((item) => item.muted)
      .map((item) => String(item.userId)),
  );

  queueChatNotifications({
    conversation,
    message,
    sender,
    participantUserIds: conversation.participants,
    mutedUserIds,
  }).catch(() => {});

  return formattedMessage;
};

const listMessagesService = async (
  currentUser,
  conversationId,
  { limit, before } = {},
) => {
  await ensureConversationAccessOrThrow(currentUser, conversationId);

  const pageSize = Math.min(
    Math.max(
      Number.parseInt(String(limit || chatConfig.defaultMessagePageSize), 10) ||
        chatConfig.defaultMessagePageSize,
      1,
    ),
    chatConfig.maxMessagePageSize,
  );

  const query = {
    conversationId,
  };

  if (before) {
    const beforeId = ensureObjectIdOrThrow(before, "before");
    const cursorMessage = await Message.findOne({
      _id: beforeId,
      conversationId,
    }).select("_id createdAt");

    if (!cursorMessage) {
      throw new CustomError("Invalid pagination cursor", [], 400);
    }

    query.createdAt = { $lt: cursorMessage.createdAt };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageSize + 1);

  const hasMore = messages.length > pageSize;
  const pageMessages = hasMore ? messages.slice(0, pageSize) : messages;
  pageMessages.reverse();

  const senderIds = [...new Set(pageMessages.map((message) => String(message.senderId)))];
  const senders = senderIds.length
    ? await User.find({ _id: { $in: senderIds } }).select(
        "_id name email role relation image",
      )
    : [];
  const sendersById = senders.reduce((accumulator, sender) => {
    accumulator.set(String(sender._id), sender);
    return accumulator;
  }, new Map());

  return {
    messages: pageMessages.map((message) =>
      formatMessage(message, sendersById.get(String(message.senderId))),
    ),
    pagination: {
      hasMore,
      nextCursor: hasMore ? String(pageMessages[0]?._id || "") : null,
    },
  };
};

const markConversationReadService = async (
  currentUser,
  conversationId,
  messageId,
  { io } = {},
) => {
  const { conversation, participant, currentUserId } =
    await ensureConversationAccessOrThrow(currentUser, conversationId);

  let lastReadMessageId = participant.lastReadMessageId;

  if (messageId) {
    const normalizedMessageId = ensureObjectIdOrThrow(messageId, "messageId");
    const message = await Message.findOne({
      _id: normalizedMessageId,
      conversationId: conversation._id,
    });

    if (!message) {
      throw new CustomError("Message not found in conversation", [], 404);
    }

    lastReadMessageId = message._id;
  } else if (!lastReadMessageId && conversation.lastMessageId) {
    lastReadMessageId = conversation.lastMessageId;
  }

  await ConversationParticipant.updateOne(
    { _id: participant._id },
    {
      $set: {
        lastReadMessageId,
        lastReadAt: new Date(),
        unreadCount: 0,
        updatedAt: new Date(),
      },
    },
  );

  const response = {
    conversationId: conversation._id,
    unreadCount: 0,
    lastReadMessageId,
  };

  if (io) {
    io.to(`conversation:${conversation._id}`).emit("message:read", {
      conversationId: conversation._id,
      userId: currentUserId,
      lastReadMessageId,
      unreadCount: 0,
    });
  }

  return response;
};

const editMessageService = async (currentUser, messageId, payload = {}) => {
  const normalizedMessageId = ensureObjectIdOrThrow(messageId, "messageId");
  const currentUserId = getCurrentUserId(currentUser);
  const text = String(payload.text || "").trim();

  if (!text) {
    throw new CustomError("Message text is required", [], 400);
  }

  const message = await Message.findById(normalizedMessageId);
  if (!message || message.deletedAt) {
    throw new CustomError("Message not found", [], 404);
  }

  if (String(message.senderId) !== String(currentUserId)) {
    throw new CustomError("You can only edit your own messages", [], 403);
  }

  if (message.type !== "text") {
    throw new CustomError("Only text messages can be edited", [], 400);
  }

  await ensureConversationAccessOrThrow(currentUser, message.conversationId);

  message.text = text;
  message.editedAt = new Date();
  await message.save();

  return formatMessage(message, await getMessageSender(message.senderId));
};

const deleteMessageService = async (currentUser, messageId, { io } = {}) => {
  const normalizedMessageId = ensureObjectIdOrThrow(messageId, "messageId");
  const currentUserId = getCurrentUserId(currentUser);

  const message = await Message.findById(normalizedMessageId);
  if (!message || message.deletedAt) {
    throw new CustomError("Message not found", [], 404);
  }

  await ensureConversationAccessOrThrow(currentUser, message.conversationId);

  if (String(message.senderId) !== String(currentUserId)) {
    throw new CustomError("You can only delete your own messages", [], 403);
  }

  message.deletedAt = new Date();
  message.text = null;
  message.attachment = null;
  await message.save();

  const formattedMessage = formatMessage(
    message,
    await getMessageSender(message.senderId),
  );

  if (io) {
    io.to(`conversation:${message.conversationId}`).emit(
      "message:new",
      formattedMessage,
    );
  }

  return formattedMessage;
};

module.exports = {
  sendMessageService,
  listMessagesService,
  markConversationReadService,
  editMessageService,
  deleteMessageService,
  validateSendMessagePayload,
};
