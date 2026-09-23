const jwt = require("jsonwebtoken");
const User = require("../../models/user");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const extractSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!authToken || typeof authToken !== "string") {
    return null;
  }

  const trimmed = authToken.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }

  return trimmed;
};

const authenticateSocket = async (socket) => {
  const token = extractSocketToken(socket);
  if (!token) {
    throw new Error("Missing socket authentication token");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.id || decoded.userId;

  if (!userId) {
    throw new Error("Invalid socket token payload");
  }

  const user = await User.findOne({
    _id: userId,
    ...ACTIVE_USER_FILTER,
  });

  if (!user) {
    throw new Error("Socket user not found");
  }

  return user;
};

const registerSocketAuth = (namespace) => {
  namespace.use(async (socket, next) => {
    try {
      socket.user = await authenticateSocket(socket);
      next();
    } catch (error) {
      next(new Error("Unauthorized socket connection"));
    }
  });
};

module.exports = {
  extractSocketToken,
  authenticateSocket,
  registerSocketAuth,
};
