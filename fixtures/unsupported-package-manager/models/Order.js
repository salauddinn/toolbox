const mongoose = require("mongoose");
module.exports = mongoose.model("Order", new mongoose.Schema({ status: String }));
