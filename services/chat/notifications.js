const ProfileSetting = require("../../models/profileSetting");
const User = require("../../models/user");
const { createImmediateNotification } = require("../notification/notification.service");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { isViewingConversation } = require("./presence");

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
    conversation.type === "family" ? "Family Group" : senderName;

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
  mutedUserIds = new Set(),
}) => {
  const senderId = String(message.senderId);
  const recipientIds = participantUserIds
    .map((id) => String(id))
    .filter((id) => id !== senderId && !mutedUserIds.has(id));

  if (!recipientIds.length) {
    return [];
  }

  const [users, profileSettings] = await Promise.all([
    User.find({
      _id: { $in: recipientIds },
      ...ACTIVE_USER_FILTER,
    }).select("_id role fcmTokens"),
    ProfileSetting.find({ userId: { $in: recipientIds } }).lean(),
  ]);

  const profileByUserId = profileSettings.reduce((accumulator, item) => {
    accumulator.set(String(item.userId), item);
    return accumulator;
  }, new Map());

  const content = buildChatNotificationContent({ sender, message, conversation });
  const notifications = [];

  for (const user of users) {
    if (!user.fcmTokens?.length) {
      continue;
    }

    if (isViewingConversation(user._id, conversation._id)) {
      continue;
    }

    const enabled = isChatNotificationEnabled(
      profileByUserId.get(String(user._id)),
      user.role,
    );

    if (!enabled) {
      continue;
    }

    notifications.push(
      createImmediateNotification({
        userId: user._id,
        type: "chat",
        referenceId: message._id,
        title: content.title,
        body: content.body,
        data: content.data,
      }),
    );
  }

  return Promise.all(notifications);
};

module.exports = {
  queueChatNotifications,
  buildChatNotificationContent,
  isChatNotificationEnabled,
};
