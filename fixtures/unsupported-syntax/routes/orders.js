const express = require("express");
const Order = require("../models/Order");

const router = express.Router();
const dynamicPath = "/dynamic";
const handlers = [
  function unsupportedHandler(_req, res) {
    res.end();
  },
];

router.get(dynamicPath, function dynamic(_req, res) {
  res.end();
});
router.get("/unsupported-handler", handlers[0]);
router.post("/", async function create(req, res) {
  await Order.create({ total: req.body.total });
  res.status(201).end();
});
router.get("/unsupported-crud", async function unsupportedCrud(_req, res) {
  await Order.bulkWrite([]);
  res.end();
});

module.exports = router;
