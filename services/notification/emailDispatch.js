const { CustomError } = require("../../utils/error");

const dispatchEmail = async (sendFn, contextLabel) => {
  try {
    await sendFn();
  } catch (error) {
    console.error(`[email] ${contextLabel} failed:`, error?.message || error);

    if (process.env.NODE_ENV === "production") {
      throw new CustomError(
        "Failed to send email. Please try again later.",
        [],
        503,
      );
    }
  }
};

module.exports = {
  dispatchEmail,
};
