require("./config/env");
const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

const appRoutes = require("./routes/index");
const pagesRouter = require("./routes/pages");
const notificationConfig = require("./config/notification");
const {
  queueUiBasePath,
  queueUiRouter,
  protectQueueUi,
} = require("./routes/queueDashboard");
const upload = require("./middlewares/multer");
const { registerChatSocketHandlers } = require("./services/chat/socket");
const {
  registerDashboardSocketHandlers,
} = require("./services/dashboard/socket");
const {
  registerCaregiverDashboardSocketHandlers,
} = require("./services/dashboard/caregiverSocket");
const {
  registerConversationListSocketHandlers,
} = require("./services/chat/conversationListSocket");
const {
  subscribeNotificationUnreadCountUpdates,
} = require("./services/notification/realtime");
const {
  subscribeDashboardUpdates,
} = require("./services/dashboard/realtime");
const {
  subscribeConversationListUpdates,
} = require("./services/chat/conversationListRealtime");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
app.locals.io = io;

const PORT = process.env.PORT || 5000;
const useHttps = process.env.APP_USE_HTTPS === "true";

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: useHttps
      ? undefined
      : {
          useDefaults: true,
          directives: {
            upgradeInsecureRequests: null,
          },
        },
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
// app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan(":method :url :status :response-time ms"));
app.use(compression());
app.use(upload.any());
app.use("/storage", express.static(path.join(__dirname, "public")));
app.use("/pages", pagesRouter);

if (notificationConfig.queueUiEnabled) {
  app.use(queueUiBasePath, protectQueueUi, queueUiRouter);
  console.log(`Queue dashboard: http://localhost:${PORT}${queueUiBasePath}`);
}

app.use("/api/v1", appRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Your backend server is running",
    timestamp: new Date().toISOString(),
  });
});

registerChatSocketHandlers(io);
const dashboardIo = registerDashboardSocketHandlers(io);
const caregiverDashboardIo = registerCaregiverDashboardSocketHandlers(io);
const conversationsIo = registerConversationListSocketHandlers(io);
app.locals.dashboardIo = dashboardIo;
app.locals.caregiverDashboardIo = caregiverDashboardIo;
app.locals.conversationsIo = conversationsIo;
subscribeNotificationUnreadCountUpdates(dashboardIo);
subscribeDashboardUpdates(dashboardIo, caregiverDashboardIo);
subscribeConversationListUpdates(conversationsIo);

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
};

startServer();
