const express = require("express");
const router = express.Router();
const login = require("../controllers/api/v1/auth/login");
const signup = require("../controllers/api/v1/auth/signup");
const forgotPassword = require("../controllers/api/v1/auth/forgotPassword");
const resetPassword = require("../controllers/api/v1/auth/resetPassword");
const resendEmailOtp = require("../controllers/api/v1/auth/resendEmailOtp");
const verifyEmailOtp = require("../controllers/api/v1/auth/verifyEmailOtp");
const socialLogin = require("../controllers/api/v1/auth/socialLogin");

router.post("/login", login);
router.post("/signup", signup);
router.post("/forgotPassword", forgotPassword);
router.post("/forgot-password", forgotPassword);
router.post("/resetPassword", resetPassword);
router.post("/reset-password", resetPassword);
router.post("/resendOtp", resendEmailOtp);
router.post("/resend-otp", resendEmailOtp);
router.post("/resend-email-otp", resendEmailOtp);
router.post("/verifyOtp", verifyEmailOtp);
router.post("/verify-otp", verifyEmailOtp);
router.post("/verify-email-otp", verifyEmailOtp);
router.post("/socialLogin", socialLogin);
router.post("/social-login", socialLogin);

module.exports = router;
