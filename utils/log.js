const logError = (...error) => {
  console.error("ERROR:", ...error);
};

const logInfo = (...info) => {
  console.info("INFO:", ...info);
};

module.exports = {
  logError,
  logInfo,
};
