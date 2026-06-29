const jwt = require("jsonwebtoken");
const User = require("../models/user");

const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }

  const headerValue = authorizationHeader.trim();
  if (!headerValue) return null;

  const [scheme, token] = headerValue.split(/\s+/);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;

  return token.replace(/^"|"$/g, "");
};

exports.protect = async (req, res, next) => {
  try {
    // 1) Read bearer token from Authorization header
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        status: "fail",
        message: "Missing or invalid Authorization header. Use: Bearer <token>",
      });
    }

    // 2) Verification token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId;

    if (!userId) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid token payload. Please log in again.",
      });
    }

    // 3) Check if user still exists
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(401).json({
        status: "fail",
        message: "The user belonging to this token no longer exists.",
      });
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "fail",
        message: "Invalid token. Please log in again.",
      });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "fail",
        message: "Your token has expired! Please log in again.",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Something went wrong verifying authentication.",
    });
  }
};
