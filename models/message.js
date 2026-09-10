const mongoose = require("mongoose");
const { MESSAGE_TYPES } = require("../config/chat");

const attachmentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    url: { type: String, default: null, trim: true },
    fileName: { type: String, default: null, trim: true },
    mimeType: { type: String, default: null, trim: true },
    size: { type: Number, default: null, min: 0 },
    duration: { type: Number, default: null, min: 0 },
    thumbnailUrl: { type: String, default: null, trim: true },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clientMessageId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: MESSAGE_TYPES,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      default: null,
      trim: true,
    },
    attachment: {
      type: attachmentSchema,
      default: null,
    },
    replyToMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, _id: -1 });
messageSchema.index({ senderId: 1, clientMessageId: 1, conversationId: 1 }, { unique: true });

module.exports = mongoose.model("Message", messageSchema);
