const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");

const router = express.Router();
const memoryUsers = [];
let userSeq = 1;

function mongoReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

router.get("/", async function listUsers(_req, res) {
  if (mongoReady()) {
    const fromDb = await User.find({});
    return res.json({ users: fromDb });
  }
  res.json({ users: memoryUsers.slice() });
});

router.post("/", async function createUser(req, res) {
  const email = req.body && req.body.email;
  const name = req.body && req.body.name;
  if (!email || !name) {
    return res.status(400).json({ error: "invalid_user" });
  }

  const user = {
    id: "usr_" + userSeq++,
    email: String(email),
    name: String(name),
  };

  if (mongoReady()) {
    await User.create({ email: user.email, name: user.name });
  }

  memoryUsers.push(user);
  return res.status(201).json({ user: user });
});

// Supported read-only access to another domain's model does not establish Write Ownership.
router.get("/:id/orders-hint", async function userOrdersHint(req, res) {
  const Order = require("../models/Order");
  let count = 0;
  if (mongoReady() && typeof Order.countDocuments === "function") {
    count = await Order.countDocuments({ userId: req.params.id });
  }
  return res.json({ userId: req.params.id, orderCount: count });
});

module.exports = router;
