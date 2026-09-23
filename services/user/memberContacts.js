const Contact = require("../../models/contact");
const { CustomError } = require("../../utils/error");
const {
  ensureObjectIdOrThrow,
  ensureParentMemberOrThrow,
} = require("./memberAccess");

const mapContact = (item) => ({
  id: item._id,
  userId: item.userId,
  name: item.name,
  phoneNumber: item.phoneNumber,
  relationship: item.relationship,
  isPrimary: item.isPrimary,
});

const createMemberContactService = async (
  currentUser,
  memberId,
  payload = {},
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);

  const name = String(payload.name || "").trim();
  const phoneNumber = String(payload.phoneNumber || "").trim();

  if (!name) {
    throw new CustomError("name is required", [], 400);
  }

  if (!phoneNumber) {
    throw new CustomError("phoneNumber is required", [], 400);
  }

  const contact = await Contact.create({
    userId: parentUser._id,
    name,
    phoneNumber,
    relationship: payload.relationship
      ? String(payload.relationship).trim()
      : null,
    isPrimary:
      payload.isPrimary !== undefined ? Boolean(payload.isPrimary) : false,
  });

  return {
    contact: mapContact(contact),
  };
};

const updateMemberContactService = async (
  currentUser,
  memberId,
  contactId,
  payload = {},
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const normalizedContactId = ensureObjectIdOrThrow(contactId, "contactId");

  const contact = await Contact.findOne({
    _id: normalizedContactId,
    userId: parentUser._id,
  });

  if (!contact) {
    throw new CustomError("Contact not found", [], 404);
  }

  if (payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (!name) {
      throw new CustomError("name cannot be empty", [], 400);
    }
    contact.name = name;
  }

  if (payload.phoneNumber !== undefined) {
    const phoneNumber = String(payload.phoneNumber || "").trim();
    if (!phoneNumber) {
      throw new CustomError("phoneNumber cannot be empty", [], 400);
    }
    contact.phoneNumber = phoneNumber;
  }

  if (payload.relationship !== undefined) {
    contact.relationship = payload.relationship
      ? String(payload.relationship).trim()
      : null;
  }

  if (payload.isPrimary !== undefined) {
    contact.isPrimary = Boolean(payload.isPrimary);
  }

  await contact.save();

  return {
    contact: mapContact(contact),
  };
};

const deleteMemberContactService = async (currentUser, memberId, contactId) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const normalizedContactId = ensureObjectIdOrThrow(contactId, "contactId");

  const deleted = await Contact.findOneAndDelete({
    _id: normalizedContactId,
    userId: parentUser._id,
  });

  if (!deleted) {
    throw new CustomError("Contact not found", [], 404);
  }

  return {
    deletedContactId: String(deleted._id),
  };
};

module.exports = {
  createMemberContactService,
  updateMemberContactService,
  deleteMemberContactService,
};
