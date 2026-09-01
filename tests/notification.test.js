const test = require("node:test");
const assert = require("node:assert/strict");
const templates = require("../services/notification/templates");
const {
  getMedicationOccurrences,
  getCheckinOccurrences,
} = require("../services/notification/scheduleCalculator");
const { isRetryableError } = require("../services/notification/sender");
const Notification = require("../models/notification");
const User = require("../models/user");
const ProfileSetting = require("../models/profileSetting");
const {
  listNotificationHistoryService,
  getUnreadNotificationCountService,
  markAllNotificationsReadService,
} = require("../services/notification/history");
const {
  createActionNotificationsForParent,
} = require("../services/notification/notification.service");

test("medication reminder template", () => {
  const result = templates.medicationReminder({
    medicationName: "Paracetamol",
  });
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

test("notification history is owned by the authenticated user and paginated", async (t) => {
  const currentUserId = "507f1f77bcf86cd799439011";
  const senderId = "507f1f77bcf86cd799439012";
  const otherUserId = "507f1f77bcf86cd799439013";
  let receivedQuery;
  let receivedSkip;
  let receivedLimit;
  let receivedSort;
  const originalFind = Notification.find;
  const originalCountDocuments = Notification.countDocuments;

  t.after(() => {
    Notification.find = originalFind;
    Notification.countDocuments = originalCountDocuments;
  });

  Notification.find = (query) => {
    receivedQuery = query;
    return {
      sort(sort) {
        receivedSort = sort;
        return this;
      },
      populate() {
        return this;
      },
      skip(skip) {
        receivedSkip = skip;
        return this;
      },
      limit(limit) {
        receivedLimit = limit;
        return this;
      },
      lean: async () => [
        {
          type: "MESSAGE",
          userId: currentUserId,
          senderId: {
            _id: senderId,
            name: "Raheem",
            role: "caregiver",
          },
          subjectUserId: {
            _id: currentUserId,
            name: "Ali",
            role: "parent",
          },
        },
      ],
    };
  };
  Notification.countDocuments = async () => 21;

  const result = await listNotificationHistoryService(
    { _id: currentUserId, role: "caregiver" },
    {
      userId: otherUserId,
      page: "2",
      limit: "20",
      type: "MESSAGE",
      senderId,
      isRead: "false",
    },
  );

  assert.deepEqual(receivedQuery, {
    userId: currentUserId,
    status: "sent",
    type: { $in: ["MESSAGE", "chat"] },
    senderId,
    isRead: false,
  });
  assert.deepEqual(receivedSort, { createdAt: -1 });
  assert.equal(receivedSkip, 20);
  assert.equal(receivedLimit, 20);
  assert.equal(result.notifications[0].type, "MESSAGE");
  assert.equal(result.notifications[0].senderId, senderId);
  assert.deepEqual(result.notifications[0].user, {
    _id: currentUserId,
    name: "Ali",
    email: null,
    imageUrl: null,
    relation: null,
    role: "parent",
  });
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 20,
    total: 21,
    totalPages: 2,
  });
});

test("loved one notification history does not include populated user object", async (t) => {
  const currentUserId = "507f1f77bcf86cd799439011";
  const originalFind = Notification.find;
  const originalCountDocuments = Notification.countDocuments;

  t.after(() => {
    Notification.find = originalFind;
    Notification.countDocuments = originalCountDocuments;
  });

  Notification.find = () => ({
    sort() {
      return this;
    },
    populate() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => [
      {
        _id: "507f1f77bcf86cd799439099",
        type: "medication",
        userId: currentUserId,
        senderId: currentUserId,
        title: "Medication Taken",
        body: "You took your medication",
        referenceId: "507f1f77bcf86cd799439018",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });
  Notification.countDocuments = async () => 1;

  const result = await listNotificationHistoryService(
    { _id: currentUserId, role: "parent" },
    {},
  );

  assert.equal(result.notifications[0].user, undefined);
});

test("unread notification count is scoped to authenticated user", async (t) => {
  const currentUserId = "507f1f77bcf86cd799439011";
  let receivedQuery;
  const originalCountDocuments = Notification.countDocuments;

  t.after(() => {
    Notification.countDocuments = originalCountDocuments;
  });

  Notification.countDocuments = async (query) => {
    receivedQuery = query;
    return 4;
  };

  const result = await getUnreadNotificationCountService({
    _id: currentUserId,
  });

  assert.deepEqual(receivedQuery, {
    userId: currentUserId,
    status: "sent",
    isRead: false,
  });
  assert.deepEqual(result, { unreadCount: 4 });
});

test("mark all notifications read only updates the authenticated user's unread records", async (t) => {
  const currentUserId = "507f1f77bcf86cd799439011";
  let receivedQuery;
  let receivedUpdate;
  const originalUpdateMany = Notification.updateMany;

  t.after(() => {
    Notification.updateMany = originalUpdateMany;
  });

  Notification.updateMany = async (query, update) => {
    receivedQuery = query;
    receivedUpdate = update;
    return { modifiedCount: 3 };
  };

  const result = await markAllNotificationsReadService({ _id: currentUserId });

  assert.deepEqual(receivedQuery, {
    userId: currentUserId,
    status: "sent",
    isRead: false,
  });
  assert.deepEqual(receivedUpdate, {
    $set: {
      isRead: true,
      readAt: receivedUpdate.$set.readAt,
    },
  });
  assert.ok(receivedUpdate.$set.readAt instanceof Date);
  assert.deepEqual(result.modifiedCount, 3);
});

test("parent care updates create a separate notification for every caregiver", async (t) => {
  const parentUserId = "507f1f77bcf86cd799439011";
  const caregiverIds = [
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013",
    "507f1f77bcf86cd799439014",
    "507f1f77bcf86cd799439015",
    "507f1f77bcf86cd799439016",
  ];
  const createdNotifications = [];
  const originalFindOne = User.findOne;
  const originalFind = User.find;
  const originalProfileSettingFind = ProfileSetting.find;
  const originalCreate = Notification.create;
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;

  t.after(() => {
    User.findOne = originalFindOne;
    User.find = originalFind;
    ProfileSetting.find = originalProfileSettingFind;
    Notification.create = originalCreate;
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  });

  User.findOne = () => ({
    select: async () => ({
      _id: parentUserId,
      familyId: "507f1f77bcf86cd799439017",
    }),
  });
  User.find = () => ({
    select: async () => caregiverIds.map((_id) => ({ _id, role: "caregiver" })),
  });
  ProfileSetting.find = () => ({
    lean: async () =>
      caregiverIds.map((userId) => ({
        userId,
        doNotDisturb: false,
        missedMedications: true,
      })),
  });
  Notification.create = async (notification) => {
    createdNotifications.push(notification);
    return {
      _id: String(createdNotifications.length),
      scheduledAt: new Date(),
    };
  };
  Notification.findOneAndUpdate = async () => null;

  await createActionNotificationsForParent({
    parentUserId,
    senderId: parentUserId,
    type: "medication",
    referenceId: "507f1f77bcf86cd799439018",
    title: "Medication status updated",
    body: "User A marked medication as taken.",
  });

  assert.equal(createdNotifications.length, 5);
  assert.deepEqual(
    createdNotifications.map((notification) => notification.userId),
    caregiverIds,
  );
  assert.ok(
    createdNotifications.every(
      (notification) => notification.subjectUserId === parentUserId,
    ),
  );
});
