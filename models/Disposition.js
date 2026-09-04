const mongoose = require("mongoose");

const dispositionSchema = new mongoose.Schema(
  {
    disposition: {
      type: String,
      required: [true, "Disposition name is required."],
      unique: true,
      trim: true,
    },
    project: {
      type: [String],
      required: [true, "Project selection is required."],
      validate: {
        validator: function (v) {
          return (
            Array.isArray(v) &&
            v.length > 0 &&
            v.every((p) => ["Silgate"].includes(p))
          );
        },
        message: "Project must be 'Silgate'.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Disposition", dispositionSchema);
