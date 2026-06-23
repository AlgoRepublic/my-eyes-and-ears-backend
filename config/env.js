const path = require("path");
const dotenv = require("dotenv");

const env = process.env.NODE_ENV || "development";

dotenv.config({
  path: path.resolve(process.cwd(), `.env.${env}`),
});

module.exports = {
  env,
  isDev: env === "development",
  isProd: env === "production",
};
