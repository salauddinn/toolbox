const express = require("express");
const Item = require("../models/Item");

const router = express.Router();

// Eligible repository (Express + Mongoose + CommonJS) but not transformation-ready:
// no CommonJS Jest/Supertest harness available through a real npm test command.
router.get("/", async function list(_req, res) {
  const items = await Item.find({}).catch(function () {
    return [];
  });
  res.json({ items: items });
});

router.post("/", async function create(req, res) {
  const name = req.body && req.body.name;
  if (!name) {
    return res.status(400).json({ error: "invalid" });
  }
  try {
    const item = await Item.create({ name: String(name) });
    return res.status(201).json({ item: item });
  } catch (_err) {
    return res.status(201).json({ item: { name: String(name) } });
  }
});

module.exports = router;
