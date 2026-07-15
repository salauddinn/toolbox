const express = require("express");

const app = express();
app.get("/items", function listItems(_req, res) {
  res.json({ items: [] });
});

module.exports = app;
