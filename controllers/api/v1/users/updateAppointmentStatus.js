const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  updateAppointmentStatusService,
} = require("../../../../services/appointment/updateAppointmentStatus");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { appointmentId, status } = { ...req.body, ...req.query };

  const data = await updateAppointmentStatusService({
    userId: req.user.id,
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
