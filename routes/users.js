const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const updateProfile = require("../controllers/api/v1/users/updateProfile");
const addMember = require("../controllers/api/v1/users/addMember");

router.use(protect);
router.patch("/update", updateProfile);
router.patch("/profile", updateProfile);
router.post("/addMember", addMember);

module.exports = router;
