const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");

const router = express.Router();

const memoryOrders = [];
let orderSeq = 1;

function listOpenOrderIds() {
  return memoryOrders
    .filter(function open(order) {
      return order.status === "pending";
    })
    .map(function idOf(order) {
      return order.id;
    });
}

function mongoReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * Export surface before requiring payments so the CommonJS cycle can resolve
 * partial exports while remaining a static require("./payments") edge.
 */
module.exports = router;
module.exports.listOpenOrderIds = listOpenOrderIds;

// Supported circular CommonJS dependency: orders ↔ payments (entry-reachable).
const payments = require("./payments");

/**
 * Legacy route handlers keep Orders business and Mongoose logic inline.
 * ToolBox extracts these into a Domain Module during the sequence.
 */
router.get("/", async function listOrders(_req, res) {
  if (mongoReady()) {
    const fromDb = await Order.find({});
    return res.json({ orders: fromDb });
  }
  res.json({ orders: memoryOrders.slice() });
});

router.get("/:id", async function getOrder(req, res) {
  const found = memoryOrders.find(function match(order) {
    return order.id === req.params.id;
  });
  if (!found) {
    return res.status(404).json({ error: "order_not_found" });
  }
  return res.json({ order: found });
});

router.post("/", async function createOrder(req, res) {
  const userId = req.body && req.body.userId;
  const total = req.body && req.body.total;
  if (!userId || typeof total !== "number") {
    return res.status(400).json({ error: "invalid_order" });
  }

  const order = {
    id: "ord_" + orderSeq++,
    userId: String(userId),
    total: total,
    status: "pending",
  };

  // Direct model write ownership for Orders (exclusive for MVP readiness).
  if (mongoReady()) {
    await Order.create({
      userId: order.userId,
      total: order.total,
      status: order.status,
    });
  }

  memoryOrders.push(order);

  const paymentSummary =
    payments && typeof payments.summarizeForOrder === "function"
      ? payments.summarizeForOrder(order.id, order.total)
      : { status: "none" };

  return res.status(201).json({ order: order, payment: paymentSummary });
});

router.post("/:id/cancel", async function cancelOrder(req, res) {
  const found = memoryOrders.find(function match(order) {
    return order.id === req.params.id;
  });
  if (!found) {
    return res.status(404).json({ error: "order_not_found" });
  }
  found.status = "cancelled";
  if (mongoReady()) {
    await Order.updateOne({ _id: found.id }, { status: "cancelled" });
  }
  return res.json({ order: found });
});
