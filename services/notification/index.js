const fcmService = require("./fcm");
const emailService = require("./email");
const notificationService = require("./notification.service");
const templates = require("./templates");
const { sendRemindParentNotification } = require("./remindParent");

module.exports = {
  ...fcmService,
  ...emailService,
  ...notificationService,
  templates,
  sendRemindParentNotification,
};
