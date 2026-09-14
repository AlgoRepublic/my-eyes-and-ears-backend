const { resolveAttachmentUrl } = require("../../utils/chatAttachmentStorage");

const formatAttachment = (attachment) => {
  if (!attachment?.key) {
    return null;
  }

  return {
    key: attachment.key,
    url: attachment.url || resolveAttachmentUrl(attachment.key),
    fileName: attachment.fileName ?? null,
    mimeType: attachment.mimeType ?? null,
    size: attachment.size ?? null,
    duration: attachment.duration ?? null,
    thumbnailUrl: attachment.thumbnailUrl ?? null,
  };
};

const formatMessage = (message, sender = null) => {
  if (!message) {
    return null;
  }

  const isDeleted = Boolean(message.deletedAt);

  return {
    _id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sender: sender
      ? {
          id: sender._id || sender.id,
          name: sender.name,
          role: sender.role,
          email: sender.email ?? null,
          relationship: sender.relation ?? null,
          profileImage: sender.image ?? null,
        }
      : null,
    clientMessageId: message.clientMessageId,
    type: message.type,
    text: isDeleted ? null : (message.text ?? null),
    attachment: isDeleted ? null : formatAttachment(message.attachment),
    replyToMessageId: message.replyToMessageId ?? null,
    isThinkingOfYou: Boolean(message.isThinkingOfYou),
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    isDeleted,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

const formatLastMessage = (message, sender = null) => {
  if (!message) {
    return null;
  }

  const formatted = formatMessage(message, sender);
  return {
    _id: formatted._id,
    type: formatted.type,
    text: formatted.text,
    senderId: formatted.senderId,
    sender: formatted.sender,
    createdAt: formatted.createdAt,
  };
};

module.exports = {
  formatMessage,
  formatLastMessage,
  formatAttachment,
};
