const express = require("express");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
// Completes the supported Orders ↔ Payments circular require (static edge).
const orders = require("./orders");

const router = express.Router();
const memoryPayments = [];
let paymentSeq = 1;

function mongoReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

router.get("/", async function listPayments(_req, res) {
  if (mongoReady()) {
    const fromDb = await Payment.find({});
    return res.json({ payments: fromDb });
  }
  res.json({ payments: memoryPayments.slice() });
});

router.post("/", async function createPayment(req, res) {
  const orderId = req.body && req.body.orderId;
  const amount = req.body && req.body.amount;
  if (!orderId || typeof amount !== "number") {
    return res.status(400).json({ error: "invalid_payment" });
  }

  const payment = {
    id: "pay_" + paymentSeq++,
    orderId: String(orderId),
    amount: amount,
    method: (req.body && req.body.method) || "card",
    status: "authorized",
  };

  if (mongoReady()) {
    await Payment.create({
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
    });
  }

  memoryPayments.push(payment);
  return res.status(201).json({ payment: payment });
});

/**
 * Used by orders through the cyclic edge.
 * Read-only toward Orders open-id listing; Payments owns Payment writes.
 */
function summarizeForOrder(orderId, amount) {
  const openIds =
    orders && typeof orders.listOpenOrderIds === "function" ? orders.listOpenOrderIds() : [];
  return {
    orderId: orderId,
    amount: amount,
    openOrderCount: openIds.length,
    status: "quoted",
  };
}

module.exports = router;
module.exports.summarizeForOrder = summarizeForOrder;
