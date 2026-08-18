const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const { getNotificationQueue } = require("../queues/notification.queue");

const QUEUE_UI_BASE_PATH =
  process.env.NOTIFICATION_QUEUE_UI_PATH || "/admin/queues";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(QUEUE_UI_BASE_PATH);

createBullBoard({
  queues: [new BullMQAdapter(getNotificationQueue())],
  serverAdapter,
});

const protectQueueUi = (req, res, next) => {
  const token = process.env.NOTIFICATION_QUEUE_UI_TOKEN;

  if (!token) {
    return next();
  }

  const headerToken = req.headers["x-queue-ui-token"];
  const queryToken = req.query.token;

  if (headerToken === token || queryToken === token) {
    return next();
  }

  return res.status(401).json({
    status: "error",
    message: "Unauthorized",
  });
};

module.exports = {
  queueUiBasePath: QUEUE_UI_BASE_PATH,
  queueUiRouter: serverAdapter.getRouter(),
  protectQueueUi,
};
