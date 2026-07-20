const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  createMemberCheckinService,
  updateMemberCheckinService,
  deleteMemberCheckinService,
} = require("../../../../services/user/memberCheckins");

const createMemberCheckin = asyncMiddleware(async (req, res, next) => {
  const data = await createMemberCheckinService(
    req.user,
    req.params.userId,
    req.body,
  );

  next({
    success: true,
    message: "Checkin reminder created successfully",
    statusCode: 200,
    data,
  });
});

const updateMemberCheckin = asyncMiddleware(async (req, res, next) => {
  const data = await updateMemberCheckinService(
    req.user,
    req.params.userId,
    req.params.checkinId,
    req.body,
  );

  next({
    success: true,
    message: "Checkin reminder updated successfully",
    statusCode: 200,
    data,
  });
});

const deleteMemberCheckin = asyncMiddleware(async (req, res, next) => {
  const data = await deleteMemberCheckinService(
    req.user,
    req.params.userId,
    req.params.checkinId,
  );

  next({
    success: true,
    message: "Checkin reminder deleted successfully",
    statusCode: 200,
    data,
  });
});

module.exports = {
  createMemberCheckin,
  updateMemberCheckin,
  deleteMemberCheckin,
};
