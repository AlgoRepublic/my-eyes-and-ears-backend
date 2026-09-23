const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  updateAppointmentStatusService,
} = require("../../../../services/appointment/updateAppointmentStatus");

module.exports = asyncMiddleware(async (req, res, next) => {
  const appointmentId =
    req.params.appointmentId ||
    req.body?.appointmentId ||
    req.query?.appointmentId;
  const status = req.body?.status || req.query?.status;
  const userId = req.query.userId || req.body?.userId;

  const data = await updateAppointmentStatusService({
    currentUser: req.user,
    userId,
    appointmentId,
    status,
  });

  next({
    success: true,
    message: "Appointment status updated successfully",
    statusCode: 200,
    data,
  });
});
