const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  triggerSosService,
  cancelSosService,
  resolveSosService,
} = require("../../../../services/user/sos");

const triggerSos = asyncMiddleware(async (req, res, next) => {
  await triggerSosService(req.user, req.body);

  next({
    success: true,
    message: "SOS alert sent to your family",
    statusCode: 200,
  });
});

const cancelSos = asyncMiddleware(async (req, res, next) => {
  await cancelSosService(req.user, req.body);

  next({
    success: true,
    message: "SOS cancelled",
    statusCode: 200,
  });
});

const resolveSos = asyncMiddleware(async (req, res, next) => {
  await resolveSosService(req.user, req.params.userId);

  next({
    success: true,
    message: "Emergency marked as resolved",
    statusCode: 200,
  });
});

module.exports = {
  triggerSos,
  cancelSos,
  resolveSos,
};
