const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  createMemberContactService,
  updateMemberContactService,
  deleteMemberContactService,
} = require("../../../../services/user/memberContacts");

const createMemberContact = asyncMiddleware(async (req, res, next) => {
  const data = await createMemberContactService(
    req.user,
    req.params.userId,
    req.body,
  );

  next({
    success: true,
    message: "Emergency contact created successfully",
    statusCode: 200,
    data,
  });
});

const updateMemberContact = asyncMiddleware(async (req, res, next) => {
  const data = await updateMemberContactService(
    req.user,
    req.params.userId,
    req.params.contactId,
    req.body,
  );

  next({
    success: true,
    message: "Emergency contact updated successfully",
    statusCode: 200,
    data,
  });
});

const deleteMemberContact = asyncMiddleware(async (req, res, next) => {
  const data = await deleteMemberContactService(
    req.user,
    req.params.userId,
    req.params.contactId,
  );

  next({
    success: true,
    message: "Emergency contact deleted successfully",
    statusCode: 200,
    data,
  });
});

module.exports = {
  createMemberContact,
  updateMemberContact,
  deleteMemberContact,
};
