const express = require("express");
const ordersRouter = require("./routes/orders");
const paymentsRouter = require("./routes/payments");
const usersRouter = require("./routes/users");

function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", function health(_req, res) {
    res.json({ status: "ok" });
  });

  app.use("/orders", ordersRouter);
  app.use("/payments", paymentsRouter);
  app.use("/users", usersRouter);

  return app;
}

module.exports = { createApp };

if (require.main === module) {
  const port = process.env.PORT || 3001;
  createApp().listen(port, function onListen() {
    // eslint-disable-next-line no-console
    console.log("controlled example listening on " + port);
  });
}
