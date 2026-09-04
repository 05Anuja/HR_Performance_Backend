const mongoose = require("mongoose");

const leadListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    campaign: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("List", leadListSchema);
