const Appointment = require("../../models/appointment");
const { CustomError } = require("../../utils/error");
const { ensureParentUserAccessOrThrow } = require("../user/memberAccess");
const {
  getComputedAppointmentStatus,
  mapAppointmentResponse,
  SCHEDULED_STATUS,
  CONFIRMED_STATUS,
  RESCHEDULED_STATUS,
  COMPLETED_STATUS,
  CANCELLED_STATUS,
} = require("./dashboardAppointments");
const { syncAppointmentNotifications } = require("../notification/sync");
const {
  createActionNotificationsForParent,
} = require("../notification/notification.service");

const PARENT_ALLOWED_STATUSES = new Set([CONFIRMED_STATUS, RESCHEDULED_STATUS]);
const CAREGIVER_ALLOWED_STATUSES = new Set([
  SCHEDULED_STATUS,
  COMPLETED_STATUS,
  CANCELLED_STATUS,
]);

const getAllowedStatusesForRole = (role) => {
  if (role === "parent") {
    return PARENT_ALLOWED_STATUSES;
  }

  if (role === "caregiver") {
    return CAREGIVER_ALLOWED_STATUSES;
  }

  return null;
};

const updateAppointmentStatusService = async ({
  currentUser,
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

  const parentUser = await ensureParentUserAccessOrThrow(currentUser, userId);
  const normalizedStatus = String(status).trim().toLowerCase();
  const allowedStatuses = getAllowedStatusesForRole(currentUser?.role);

  if (!allowedStatuses) {
    throw new CustomError(
      "Only parent or caregiver users can update appointment status",
      [],
      403,
    );
  }

  if (!allowedStatuses.has(normalizedStatus)) {
    throw new CustomError("Invalid appointment status", [], 400);
  }

  const updatedAppointment = await Appointment.findOneAndUpdate(
    {
      _id: appointmentId,
      userId: parentUser._id,
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

  syncAppointmentNotifications(updatedAppointment._id);

  await createActionNotificationsForParent({
    parentUserId: parentUser._id,
    senderId: currentUser._id || currentUser.id,
    type: "appointment",
    referenceId: updatedAppointment._id,
    title: "Appointment status updated",
    body: `${parentUser.name}'s appointment was marked as ${updatedAppointment.status}.`,
    data: {
      type: "appointment_status",
      appointmentId: String(updatedAppointment._id),
      parentUserId: String(parentUser._id),
      status: updatedAppointment.status,
    },
  });

  const computedStatus = getComputedAppointmentStatus(updatedAppointment);

  return mapAppointmentResponse(updatedAppointment, computedStatus);
};

module.exports = {
  updateAppointmentStatusService,
  PARENT_ALLOWED_STATUSES,
  CAREGIVER_ALLOWED_STATUSES,
};
