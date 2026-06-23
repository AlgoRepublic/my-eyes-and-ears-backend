class CustomError extends Error {
  constructor(message, errors, statusCode = 400) {
    super(message);
    this.errors = errors || [];
    this.statusCode = statusCode;
  }
}

module.exports = {
  CustomError,
};
