const Appointment = require("../../models/appointment");
const { CustomError } = require("../../utils/error");
const { getComputedAppointmentStatus } = require("./dashboardAppointments");

const ALLOWED_STATUSES = new Set(["scheduled", "completed", "cancelled"]);

const updateAppointmentStatusService = async ({
  userId,
  appointmentId,
  status,
}) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  if (!appointmentId || !status) {
    throw new CustomError("appointmentId and status are required", [], 400);
  }

  const normalizedStatus = String(status).trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(normalizedStatus)) {
    throw new CustomError("Invalid appointment status", [], 400);
  }

  const updatedAppointment = await Appointment.findOneAndUpdate(
    {
      _id: appointmentId,
      userId,
    },
    {
      $set: {
        status: normalizedStatus,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedAppointment) {
    throw new CustomError("Appointment not found", [], 404);
  }

  const computedStatus = getComputedAppointmentStatus(updatedAppointment);

  return {
    id: updatedAppointment._id,
    userId: updatedAppointment.userId,
    doctorName: updatedAppointment.doctorName,
    reason: updatedAppointment.reason,
    date: updatedAppointment.date,
    time: updatedAppointment.time,
    location: updatedAppointment.location,
    rider: updatedAppointment.rider,
    status: computedStatus,
    createdAt: updatedAppointment.createdAt,
    updatedAt: updatedAppointment.updatedAt,
  };
};

module.exports = {
  updateAppointmentStatusService,
};
