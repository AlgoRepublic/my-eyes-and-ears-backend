const express = require("express");
const path = require("path");

const router = express.Router();
const pagesDir = path.join(__dirname, "../public/pages");

router.get("/terms-and-conditions", (req, res) => {
  res.sendFile(path.join(pagesDir, "terms-and-conditions.html"));
});

router.get("/privacy-policy", (req, res) => {
  res.sendFile(path.join(pagesDir, "privacy-policy.html"));
});

router.use(express.static(pagesDir));

module.exports = router;
