const multer = require("multer");

// Configure storage (can be memoryStorage or diskStorage)
const storage = multer.memoryStorage();

// Create multer instance
const upload = multer({ storage: storage });

module.exports = upload;
