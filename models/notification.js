const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "medication",
  "appointment",
  "checkinReminder",
  "chat",
  "MESSAGE",
  "sos",
  "SOS",
];
const NOTIFICATION_STATUSES = [
  "pending",
  "queued",
  "processing",
  "sent",
  "failed",
  "cancelled",
];

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    subjectUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      trim: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: NOTIFICATION_STATUSES,
      default: "pending",
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
      trim: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ userId: 1, scheduledAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, type: 1, senderId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, subjectUserId: 1, createdAt: -1 });
notificationSchema.index({ referenceId: 1, type: 1, status: 1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true });

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.NOTIFICATION_STATUSES = NOTIFICATION_STATUSES;
