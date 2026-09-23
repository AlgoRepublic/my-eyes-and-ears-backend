const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  getUpcomingAppointmentsService,
  createMemberAppointmentService,
  updateMemberAppointmentService,
  deleteMemberAppointmentService,
} = require("../../../../services/user/memberAppointments");

const getUpcomingAppointments = asyncMiddleware(async (req, res, next) => {
  const userId = req.query.userId || req.body?.userId;
  const data = await getUpcomingAppointmentsService(req.user, userId);

  next({
    success: true,
    message: "Upcoming appointments fetched successfully",
    statusCode: 200,
    data,
  });
});

const createMemberAppointment = asyncMiddleware(async (req, res, next) => {
  const data = await createMemberAppointmentService(
    req.user,
    req.params.userId,
    req.body,
  );

  next({
    success: true,
    message: "Appointment created successfully",
    statusCode: 200,
    data,
  });
});

const updateMemberAppointment = asyncMiddleware(async (req, res, next) => {
  const data = await updateMemberAppointmentService(
    req.user,
    req.params.userId,
    req.params.appointmentId,
    req.body,
  );

  next({
    success: true,
    message: "Appointment updated successfully",
    statusCode: 200,
    data,
  });
});

const deleteMemberAppointment = asyncMiddleware(async (req, res, next) => {
  const data = await deleteMemberAppointmentService(
    req.user,
    req.params.userId,
    req.params.appointmentId,
  );

  next({
    success: true,
    message: "Appointment deleted successfully",
    statusCode: 200,
    data,
  });
});

module.exports = {
  getUpcomingAppointments,
  createMemberAppointment,
  updateMemberAppointment,
  deleteMemberAppointment,
};
