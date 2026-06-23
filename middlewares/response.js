const { CustomError } = require("../utils/error");
const { jsonResponse } = require("../utils/response");
const { logError } = require("../utils/log");

module.exports = (err, req, res, next) => {
  let success = false;
  let message = "Internal server error";
  let statusCode = 500;
  let data = null;
  let errors = null;
  if (err instanceof CustomError) {
    message = err?.message ?? message;
    statusCode = err?.statusCode ?? statusCode;
    errors = err?.errors ? err?.errors : [];
    logError(err);
  } else if (err instanceof Error) {
    logError(err);
  } else if (err && typeof err === "object") {
    success = err?.success ?? success;
    message = err?.message ?? message;
    statusCode = success ? 200 : 400;
    data = err?.data ?? data;
  }

  return jsonResponse(res, success, message, data, errors, statusCode);
};
