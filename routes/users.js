const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const updateProfile = require("../controllers/api/v1/users/updateProfile");

router.use(protect);
router.patch("/update", updateProfile);
router.patch("/profile", updateProfile);

module.exports = router;
