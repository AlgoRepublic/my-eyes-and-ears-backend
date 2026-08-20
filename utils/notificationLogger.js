const logNotificationEvent = (event, payload = {}) => {
  const entry = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  console.log(JSON.stringify(entry));
};

module.exports = {
  logNotificationEvent,
};
