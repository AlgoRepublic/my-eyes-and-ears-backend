const express = require("express");
const app = express.Router();
const authRouter = require("./auth");
const usersRouter = require("./users");
const chatRouter = require("./chat");
const notificationsRouter = require("./notifications");
const responseHandler = require("../middlewares/response");

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/chat", chatRouter);
app.use("/notifications", notificationsRouter);
app.use(responseHandler);
module.exports = app;
