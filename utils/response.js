const jsonResponse = (
  res,
  isSuccess,
  message,
  data = null,
  errors = null,
  statusCode
) => {
  const response = {
    success: isSuccess,
    message: message,
    statusCode: statusCode || (isSuccess ? 200 : 400),
    data,
    errors,
  };

  return res.status(response.statusCode).json(response);
};

module.exports = { jsonResponse };
