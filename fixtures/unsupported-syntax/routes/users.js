const express = require("express");
const User = require("../models/User");

const router = express.Router();
router.post("/", async function createUser(req, res) {
  const user = await User.create({ name: req.body.name });
  res.status(201).json(user);
});

module.exports = router;
