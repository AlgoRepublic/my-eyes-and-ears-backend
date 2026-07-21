const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const updateProfile = require("../controllers/api/v1/users/updateProfile");
const addMember = require("../controllers/api/v1/users/addMember");
const addCaregiver = require("../controllers/api/v1/users/addCaregiver");
const updateMember = require("../controllers/api/v1/users/updateMember");
const getMembers = require("../controllers/api/v1/users/getMembers");
const getMemberDetail = require("../controllers/api/v1/users/getMemberDetail");
const {
  createMemberCheckin,
  updateMemberCheckin,
  deleteMemberCheckin,
} = require("../controllers/api/v1/users/memberCheckins");
const {
  createMemberContact,
  updateMemberContact,
  deleteMemberContact,
} = require("../controllers/api/v1/users/memberContacts");
const {
  createMemberAppointment,
  updateMemberAppointment,
  deleteMemberAppointment,
} = require("../controllers/api/v1/users/memberAppointments");
const {
  createMemberMedication,
  updateMemberMedication,
  deleteMemberMedication,
} = require("../controllers/api/v1/users/memberMedications");
const deleteMember = require("../controllers/api/v1/users/deleteMember");
const deleteCaregiver = require("../controllers/api/v1/users/deleteCaregiver");
const updateMedicationStatus = require("../controllers/api/v1/users/updateMedicationStatus");
const updateAppointmentStatus = require("../controllers/api/v1/users/updateAppointmentStatus");

router.use(protect);
router.patch("/update", updateProfile);
router.patch("/profile", updateProfile);
router.post("/addMember", addMember);
router.post("/addCaregiver", addCaregiver);
router.get("/members", getMembers);
router.get("/getMembers", getMembers);
router.get("/member/:userId", getMemberDetail);
router.get("/getMemberDetail/:userId", getMemberDetail);
router.patch("/members/:userId", updateMember);
// ==================checkins start==================
router.post("/members/:userId/checkins", createMemberCheckin);
router.patch("/members/:userId/checkins/:checkinId", updateMemberCheckin);
router.delete("/members/:userId/checkins/:checkinId", deleteMemberCheckin);
// ==================checkins end==================

// ==================contacts start==================
router.post("/members/:userId/contacts", createMemberContact);
router.patch("/members/:userId/contacts/:contactId", updateMemberContact);
router.delete("/members/:userId/contacts/:contactId", deleteMemberContact);
// ==================contacts end==================

// ==================appointments start==================
router.post("/members/:userId/appointments", createMemberAppointment);
router.patch(
  "/members/:userId/appointments/:appointmentId",
  updateMemberAppointment,
);
router.delete(
  "/members/:userId/appointments/:appointmentId",
  deleteMemberAppointment,
);
// ==================appointments end==================

// ==================medications start==================
router.post("/members/:userId/medications", createMemberMedication);
router.patch(
  "/members/:userId/medications/:medicationId",
  updateMemberMedication,
);
router.delete(
  "/members/:userId/medications/:medicationId",
  deleteMemberMedication,
);
// ==================medications end==================
router.delete("/members/:userId", deleteMember);
router.delete("/caregivers/:userId", deleteCaregiver);
router.delete("/caregiver/:userId", deleteCaregiver);
router.patch("/medications/status", updateMedicationStatus);
router.patch("/medication/status", updateMedicationStatus);
router.patch("/appointments/status", updateAppointmentStatus);
router.patch("/appointment/status", updateAppointmentStatus);

module.exports = router;
