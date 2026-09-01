const ProfileSetting = require("../../models/profileSetting");
const User = require("../../models/user");
const {
  createImmediateNotification,
} = require("../notification/notification.service");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const isChatNotificationEnabled = (profileSetting, role) => {
  if (!profileSetting || profileSetting.doNotDisturb) {
    return false;
  }

  if (role === "parent") {
    return profileSetting.familyMessages !== false;
  }

  if (role === "caregiver") {
    return profileSetting.newFamilyMessages !== false;
  }

  return false;
};

const buildChatNotificationContent = ({ sender, message, conversation }) => {
  const senderName = sender?.name || "Family member";
  let body = "Sent a message";

  if (message.type === "text" && message.text) {
    body = message.text.slice(0, 120);
  } else if (message.type === "image") {
    body = "Sent a photo";
  } else if (message.type === "video") {
    body = "Sent a video";
  } else if (message.type === "audio") {
    body = "Sent a voice message";
  } else if (message.type === "file") {
    body = "Sent a file";
  }

  const title =
    conversation.type === "family"
      ? `${senderName} sent a message in Family Group`
      : `${senderName} sent you a message`;

  return {
    title,
    body,
    data: {
      type: "chat_message",
      conversationId: String(conversation._id),
      messageId: String(message._id),
      senderId: String(message.senderId),
      conversationType: conversation.type,
    },
  };
};

const queueChatNotifications = async ({
  conversation,
  message,
  sender,
  participantUserIds = [],
}) => {
  const senderId = String(message.senderId);
  const recipientIds = participantUserIds
    .map((id) => String(id))
    .filter((id) => id !== senderId);

  if (!recipientIds.length) {
    return [];
  }

  const users = await User.find({
    _id: { $in: recipientIds },
    ...ACTIVE_USER_FILTER,
  }).select("_id role");

  const content = buildChatNotificationContent({
    sender,
    message,
    conversation,
  });

  return Promise.all(
    users.map((user) =>
      createImmediateNotification({
        userId: user._id,
        senderId: message.senderId,
        subjectUserId:
          user.role === "caregiver" && sender?.role === "parent"
            ? sender._id
            : null,
        type: "MESSAGE",
        referenceId: message._id,
        title: content.title,
        body: content.body,
        data: content.data,
        dedupeKey: `MESSAGE:${String(message._id)}:${String(user._id)}`,
      }),
    ),
  );
};

module.exports = {
  queueChatNotifications,
  buildChatNotificationContent,
  isChatNotificationEnabled,
};
