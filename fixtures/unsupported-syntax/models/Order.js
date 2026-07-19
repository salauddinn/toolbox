const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({ total: Number }, { collection: "orders" });
const RegisteredOrder = mongoose.model("Order", orderSchema);
const modelName = "Order";
const Order = mongoose.model(modelName, orderSchema);

module.exports = RegisteredOrder;
