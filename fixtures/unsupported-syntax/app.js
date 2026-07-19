const express = require("express");
const ordersRouter = require("./routes/orders");

const app = express();
const ordersPrefix = "/orders";
app.use(ordersPrefix, ordersRouter);
const auth = function auth(_req, _res, next) {
  next();
};
app.use("/orders-direct", require("./routes/orders"));
app.use("/orders-secured", auth, ordersRouter);
const usersRouter = require("./routes/users");
app.use("/user", usersRouter);
app.get("/health", function health(_req, res) {
  res.json({ status: "ok" });
});

module.exports = app;
