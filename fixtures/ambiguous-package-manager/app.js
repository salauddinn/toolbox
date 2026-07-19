const express = require("express");
const app = express();
app.get("/orders", (_req, res) => res.json({ ok: true }));
module.exports = app;
