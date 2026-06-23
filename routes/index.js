const express = require("express");
const app = express.Router();
const authRouter = require("./auth");
const responseHandler = require("../middlewares/response");

app.use("/auth", authRouter);
app.use(responseHandler);
module.exports = app;
