const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: "card" },
    status: {
      type: String,
      enum: ["authorized", "captured", "failed"],
      default: "authorized",
    },
  },
  { collection: "payments" },
);

const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

module.exports = Payment;
