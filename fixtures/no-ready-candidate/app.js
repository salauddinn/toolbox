const express = require("express");
const items = require("./routes/items");

const app = express();
app.use(express.json());
app.use("/items", items);

module.exports = app;
