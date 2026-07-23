const fs = require("fs");
const express = require("express");
const path = require("path");

const router = express.Router();
const pagesDir = path.join(__dirname, "../public/pages");
const stylesheetPath = path.join(pagesDir, "styles.css");

const readStylesheet = () => {
  return fs.readFileSync(stylesheetPath, "utf8");
};

const serveLegalPage = (fileName) => (req, res) => {
  const htmlPath = path.join(pagesDir, fileName);
  let html = fs.readFileSync(htmlPath, "utf8");
  const styles = readStylesheet();

  html = html.replace(
    '<link rel="stylesheet" href="/pages/styles.css" />',
    `<style>${styles}</style>`,
  );

  res.type("html").send(html);
};

router.get("/terms-and-conditions", serveLegalPage("terms-and-conditions.html"));
router.get("/privacy-policy", serveLegalPage("privacy-policy.html"));

router.get("/styles.css", (req, res) => {
  res.type("css").send(readStylesheet());
});

module.exports = router;
