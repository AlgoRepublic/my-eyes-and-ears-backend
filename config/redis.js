const Redis = require("ioredis");
const notificationConfig = require("./notification");

let sharedConnection = null;

const createRedisConnection = () => {
  return new Redis(notificationConfig.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
};

const getRedisConnection = () => {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection();
  }
  return sharedConnection;
};

const closeRedisConnection = async () => {
  if (!sharedConnection) {
    return;
  }

  const connection = sharedConnection;
  sharedConnection = null;
  await connection.quit();
};

module.exports = {
  createRedisConnection,
  getRedisConnection,
  closeRedisConnection,
};
