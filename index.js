require("./config/env");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const connectDB = require("./config/db");

const appRoutes = require("./routes/index");

const app = express();
const PORT = process.env.PORT || 5000;
const path = require("path");
const upload = require("./middlewares/multer");

// Middleware
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
// app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan(":method :url :status :response-time ms"));
app.use(compression());
app.use(upload.any());
//  this is used for some static files that are stored on the server
app.use("/storage", express.static(path.join(__dirname, "public")));
// Routes
app.use("/api/v1", appRoutes);

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Your backend server is running",
    timestamp: new Date().toISOString(),
  });
});

// Start Server
const startServer = async () => {
  connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
};

startServer();
// Humsafar Gharana ApnaRishtaa
