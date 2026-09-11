const mongoose = require("mongoose");

const sosLocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    accuracy: {
      type: Number,
      default: null,
    },
    address: {
      type: String,
      default: null,
      trim: true,
    },
    city: {
      type: String,
      default: null,
      trim: true,
    },
    state: {
      type: String,
      default: null,
      trim: true,
    },
    country: {
      type: String,
      default: null,
      trim: true,
    },
    postalCode: {
      type: String,
      default: null,
      trim: true,
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const SOS_STATUSES = ["active", "cancelled", "resolved"];

const sosSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: SOS_STATUSES,
      required: true,
      default: "active",
      index: true,
    },
    location: {
      type: sosLocationSchema,
      default: null,
    },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

sosSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  },
);

module.exports = mongoose.model("Sos", sosSchema);
module.exports.SOS_STATUSES = SOS_STATUSES;
