const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const updateProfile = require("../controllers/api/v1/users/updateProfile");
const addMember = require("../controllers/api/v1/users/addMember");
const getMembers = require("../controllers/api/v1/users/getMembers");
const updateMedicationStatus = require("../controllers/api/v1/users/updateMedicationStatus");
const updateAppointmentStatus = require("../controllers/api/v1/users/updateAppointmentStatus");

router.use(protect);
router.patch("/update", updateProfile);
router.patch("/profile", updateProfile);
router.post("/addMember", addMember);
router.get("/members", getMembers);
router.get("/getMembers", getMembers);
router.patch("/medications/status", updateMedicationStatus);
router.patch("/medication/status", updateMedicationStatus);
router.patch("/appointments/status", updateAppointmentStatus);
router.patch("/appointment/status", updateAppointmentStatus);

module.exports = router;
