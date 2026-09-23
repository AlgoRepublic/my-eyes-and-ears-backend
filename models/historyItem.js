const mongoose = require("mongoose");

const HISTORY_KINDS = ["scan", "translation", "magnifier"];

const historyItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: HISTORY_KINDS,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    extractedText: {
      type: String,
      default: null,
    },
    sourceText: {
      type: String,
      default: null,
    },
    translatedText: {
      type: String,
      default: null,
    },
    sourceLanguage: {
      type: String,
      default: null,
      trim: true,
    },
    targetLanguage: {
      type: String,
      default: null,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: null,
      trim: true,
    },
    brightness: {
      type: Number,
      default: null,
    },
    contrast: {
      type: Number,
      default: null,
    },
    zoom: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "history_items",
  },
);

historyItemSchema.index({ userId: 1, createdAt: -1 });
historyItemSchema.index({ userId: 1, kind: 1, createdAt: -1 });

module.exports = mongoose.model("HistoryItem", historyItemSchema);
module.exports.HISTORY_KINDS = HISTORY_KINDS;
