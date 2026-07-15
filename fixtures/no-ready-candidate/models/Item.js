const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    name: String,
  },
  { collection: "items" },
);

module.exports = mongoose.models.Item || mongoose.model("Item", itemSchema);
