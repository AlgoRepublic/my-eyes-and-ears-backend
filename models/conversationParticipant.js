const mongoose = require("mongoose");

const conversationParticipantSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    muted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

conversationParticipantSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationParticipantSchema.index({ userId: 1, conversationId: 1 });
conversationParticipantSchema.index({ userId: 1, unreadCount: 1 });

module.exports = mongoose.model(
  "ConversationParticipant",
  conversationParticipantSchema,
);
