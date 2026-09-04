const mongoose = require("mongoose");

const designationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Designation name is required."],
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
            v.every((p) => ["Silgate", "Talent Corner"].includes(p))
          );
        },
        message: "Project must be 'Silgate' and/or 'Talent Corner'.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Designation", designationSchema);
