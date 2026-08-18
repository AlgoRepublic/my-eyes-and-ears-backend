const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toMs = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const notificationConfig = {
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  queueName: process.env.NOTIFICATION_QUEUE_NAME || "notifications",

  workerConcurrency: toInt(process.env.NOTIFICATION_WORKER_CONCURRENCY, 25),
  maxAttempts: toInt(process.env.NOTIFICATION_MAX_ATTEMPTS, 4),
  backoffDelayMs: toInt(process.env.NOTIFICATION_BACKOFF_DELAY, 5000),

  schedulerIntervalMs: toMs(process.env.NOTIFICATION_SCHEDULER_INTERVAL, 30000),
  schedulerWindowMs: toMs(process.env.NOTIFICATION_SCHEDULER_WINDOW, 120000),
  schedulerBatchSize: toInt(process.env.NOTIFICATION_SCHEDULER_BATCH_SIZE, 500),
  horizonDays: toInt(process.env.NOTIFICATION_HORIZON_DAYS, 14),

  appointmentReminderOffsetMs: toMs(
    process.env.NOTIFICATION_APPOINTMENT_OFFSET_MS,
    0,
  ),

  fcmMulticastBatchSize: toInt(process.env.NOTIFICATION_FCM_BATCH_SIZE, 500),

  gracefulShutdownTimeoutMs: toMs(
    process.env.NOTIFICATION_SHUTDOWN_TIMEOUT_MS,
    30000,
  ),

  queueUiEnabled:
    process.env.NOTIFICATION_QUEUE_UI_ENABLED === "true" ||
    process.env.NODE_ENV === "development",
  queueUiPath: process.env.NOTIFICATION_QUEUE_UI_PATH || "/admin/queues",
};

module.exports = notificationConfig;
