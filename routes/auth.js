const express = require("express");
const router = express.Router();
const login = require("../controllers/api/v1/auth/login");
const signup = require("../controllers/api/v1/auth/signup");
const resendEmailOtp = require("../controllers/api/v1/auth/resendEmailOtp");
const verifyEmailOtp = require("../controllers/api/v1/auth/verifyEmailOtp");

router.post("/login", login);
router.post("/signup", signup);
router.post("/resendOtp", resendEmailOtp);
router.post("/resend-otp", resendEmailOtp);
router.post("/resend-email-otp", resendEmailOtp);
router.post("/verifyOtp", verifyEmailOtp);
router.post("/verify-otp", verifyEmailOtp);
router.post("/verify-email-otp", verifyEmailOtp);

module.exports = router;
