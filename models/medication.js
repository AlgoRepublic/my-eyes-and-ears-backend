const mongoose = require("mongoose");

const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const MEDICATION_FREQUENCIES = ["daily", "weekly", "custom_dates"];

const medicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      default: null,
      trim: true,
    },
    frequency: {
      type: String,
      default: null,
      trim: true,
      enum: {
        values: [...MEDICATION_FREQUENCIES, null],
        message: "frequency must be one of daily, weekly, custom_dates",
      },
    },
    days: {
      type: [String],
      default: [],
      validate: {
        validator: (value = []) =>
          value.every((item) => WEEK_DAYS.includes(item)),
        message: "days must contain valid weekdays (monday to sunday)",
      },
    },
    dates: {
      type: [Date],
      default: [],
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    time: {
      type: String,
      default: null,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

medicationSchema.pre("validate", function validateSchedule() {
  if (this.frequency === "weekly" && this.days.length === 0) {
    this.invalidate("days", "days are required when frequency is weekly");
  }

  if (this.frequency === "custom_dates" && this.dates.length === 0) {
    this.invalidate(
      "dates",
      "dates are required when frequency is custom_dates",
    );
  }

  if (this.frequency !== "weekly") {
    this.days = [];
  }

  if (this.frequency !== "custom_dates") {
    this.dates = [];
  }
});

module.exports = mongoose.model("Medication", medicationSchema);
