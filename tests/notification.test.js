const test = require("node:test");
const assert = require("node:assert/strict");
const templates = require("../services/notification/templates");
const {
  getMedicationOccurrences,
  getCheckinOccurrences,
} = require("../services/notification/scheduleCalculator");
const { isRetryableError } = require("../services/notification/sender");

test("medication reminder template", () => {
  const result = templates.medicationReminder({ medicationName: "Paracetamol" });
  assert.equal(result.title, "Medication Reminder");
  assert.match(result.body, /Paracetamol/);
});

test("appointment reminder template", () => {
  const result = templates.appointmentReminder({
    doctorName: "Dr. Ahmed",
    timeLabel: "5:00 PM",
  });
  assert.match(result.body, /Dr\. Ahmed/);
});

test("daily medication occurrences stay within horizon", () => {
  const now = new Date("2026-08-18T10:00:00.000Z");
  const occurrences = getMedicationOccurrences(
    {
      isActive: true,
      frequency: "daily",
      time: "09:00 AM",
      startDate: null,
      endDate: null,
    },
    now,
  );

  assert.ok(occurrences.length > 0);
  assert.ok(occurrences.every((item) => item >= now));
});

test("disabled checkin returns no occurrences", () => {
  const occurrences = getCheckinOccurrences(
    {
      isEnabled: false,
      time: "08:00 AM",
    },
    new Date("2026-08-18T10:00:00.000Z"),
  );

  assert.equal(occurrences.length, 0);
});

test("invalid fcm token errors are not retryable", () => {
  assert.equal(
    isRetryableError({ code: "messaging/registration-token-not-registered" }),
    false,
  );
});

test("network errors are retryable", () => {
  assert.equal(isRetryableError({ message: "network timeout" }), true);
});
