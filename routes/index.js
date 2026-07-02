const express = require("express");
const app = express.Router();
const authRouter = require("./auth");
const usersRouter = require("./users");
const responseHandler = require("../middlewares/response");

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use(responseHandler);
module.exports = app;
