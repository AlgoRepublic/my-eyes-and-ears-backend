const test = require("node:test");
const assert = require("node:assert/strict");
const { buildIndividualConversationKey } = require("../services/chat/chatAccess");
const { formatMessage } = require("../services/chat/formatMessage");
const {
  validateAttachmentFile,
  resolveAttachmentCategory,
} = require("../utils/chatAttachmentStorage");
const { validateSendMessagePayload } = require("../services/chat/messages");
const { CustomError } = require("../utils/error");
const {
  buildChatNotificationContent,
} = require("../services/chat/notifications");

test("individual conversation key is stable regardless of user order", () => {
  const familyId = "64f1a2b3c4d5e6f7a8b9c0d1";
  const userA = "64f1a2b3c4d5e6f7a8b9c0d2";
  const userB = "64f1a2b3c4d5e6f7a8b9c0d3";

  const keyOne = buildIndividualConversationKey(familyId, userA, userB);
  const keyTwo = buildIndividualConversationKey(familyId, userB, userA);

  assert.equal(keyOne, keyTwo);
  assert.match(keyOne, new RegExp(`^${familyId}:`));
});

test("unsupported attachment mime type is rejected", () => {
  assert.throws(
    () =>
      validateAttachmentFile(
        {
          buffer: Buffer.from("test"),
          mimetype: "application/x-msdownload",
          size: 1000,
          originalname: "virus.exe",
        },
        "file",
      ),
    (error) => error instanceof CustomError && error.statusCode === 400,
  );
});

test("oversized image attachment is rejected", () => {
  assert.throws(
    () =>
      validateAttachmentFile(
        {
          buffer: Buffer.from("test"),
          mimetype: "image/jpeg",
          size: 50 * 1024 * 1024,
          originalname: "photo.jpg",
        },
        "image",
      ),
    (error) => error instanceof CustomError && /size/i.test(error.message),
  );
});

test("voice message maps to audio category", () => {
  assert.equal(resolveAttachmentCategory("audio/m4a"), "audio");
});

test("text message payload validation requires text", async () => {
  await assert.rejects(
    () =>
      validateSendMessagePayload({
        clientMessageId: "abc-123",
        type: "text",
        text: "   ",
      }),
    (error) => error instanceof CustomError,
  );
});

test("attachment message requires uploaded file", async () => {
  await assert.rejects(
    () =>
      validateSendMessagePayload(
        {
          clientMessageId: "voice-1",
          type: "audio",
          duration: 12,
        },
        { userId: "64f1a2b3c4d5e6f7a8b9c0d2" },
      ),
    (error) => error instanceof CustomError && /attachment file/i.test(error.message),
  );
});

test("deleted messages are returned with isDeleted flag", () => {
  const formatted = formatMessage({
    _id: "64f1a2b3c4d5e6f7a8b9c0d1",
    conversationId: "64f1a2b3c4d5e6f7a8b9c0d2",
    senderId: "64f1a2b3c4d5e6f7a8b9c0d3",
    clientMessageId: "client-1",
    type: "text",
    text: "secret",
    deletedAt: new Date("2026-08-27T10:00:00.000Z"),
    createdAt: new Date("2026-08-27T09:00:00.000Z"),
    updatedAt: new Date("2026-08-27T10:00:00.000Z"),
  });

  assert.equal(formatted.isDeleted, true);
  assert.equal(formatted.text, null);
});

test("chat notification payload includes conversation metadata", () => {
  const content = buildChatNotificationContent({
    sender: { name: "Sarah" },
    message: {
      _id: "64f1a2b3c4d5e6f7a8b9c0d4",
      senderId: "64f1a2b3c4d5e6f7a8b9c0d5",
      type: "text",
      text: "Thinking of you today",
    },
    conversation: {
      _id: "64f1a2b3c4d5e6f7a8b9c0d6",
      type: "individual",
    },
  });

  assert.equal(content.data.type, "chat_message");
  assert.equal(content.data.conversationId, "64f1a2b3c4d5e6f7a8b9c0d6");
  assert.match(content.body, /Thinking of you today/);
  assert.match(content.title, /Sarah sent you a message/);
});
