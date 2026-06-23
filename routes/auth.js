const express = require("express");
const router = express.Router();
const login = require("../controllers/api/v1/auth/login");
const signup = require("../controllers/api/v1/auth/signup");

router.post("/login", login);
router.post("/signup", signup);

module.exports = router;
