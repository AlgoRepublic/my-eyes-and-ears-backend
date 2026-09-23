const Sos = require("../../models/sos");
const { registerSocketAuth } = require("../socket/auth");
const { buildUserRoom } = require("../notification/realtime");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const User = require("../../models/user");
const { buildMemberSosStatusSocketPayload } = require("../user/sosFormat");

const CAREGIVER_DASHBOARD_SOCKET_NAMESPACE = "/caregiverDashboardData";

const emitActiveMemberSosStatuses = async (caregiverDashboardIo, socket) => {
  if (socket.user?.role !== "caregiver") {
    return;
  }

  let familyId;
  try {
    familyId = await getFamilyIdOrThrow(socket.user);
  } catch (_error) {
    return;
  }

  const members = await User.find({
    familyId,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  }).select("_id");

  if (!members.length) {
    return;
  }

  const activeSosRecords = await Sos.find({
    userId: { $in: members.map((member) => member._id) },
    status: "active",
  });

  await Promise.all(
    activeSosRecords.map(async (sos) => {
      const payload = await buildMemberSosStatusSocketPayload(sos, "active");
      socket.emit("member:sosStatus", payload);
    }),
  );
};

const registerCaregiverDashboardSocketHandlers = (io) => {
  const caregiverDashboardIo = io.of(CAREGIVER_DASHBOARD_SOCKET_NAMESPACE);

  registerSocketAuth(caregiverDashboardIo);

  caregiverDashboardIo.on("connection", async (socket) => {
    socket.join(buildUserRoom(socket.user._id));

    try {
      await emitActiveMemberSosStatuses(caregiverDashboardIo, socket);
    } catch (error) {
      console.error("Failed to send initial caregiver SOS data", error);
    }
  });

  return caregiverDashboardIo;
};

module.exports = {
  registerCaregiverDashboardSocketHandlers,
  CAREGIVER_DASHBOARD_SOCKET_NAMESPACE,
};
