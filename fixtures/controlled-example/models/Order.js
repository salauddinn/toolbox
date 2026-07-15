const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },
  },
  { collection: "orders" },
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

module.exports = Order;
