const mongoose = require("mongoose");

const CONVERSATION_TYPES = ["family", "individual"];

const conversationSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      required: true,
    },
    type: {
      type: String,
      enum: CONVERSATION_TYPES,
      required: true,
    },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      index: true,
    },
    individualKey: {
      type: String,
      default: null,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

conversationSchema.index({ familyId: 1, lastMessageAt: -1 });
conversationSchema.index(
  { individualKey: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "individual", individualKey: { $type: "string" } },
  },
);
conversationSchema.index(
  { familyId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "family" },
  },
);

module.exports = mongoose.model("Conversation", conversationSchema);
module.exports.CONVERSATION_TYPES = CONVERSATION_TYPES;
