const mongoose = require("mongoose");

const sourcesSchema = new mongoose.Schema(
  {
    sourceName: {
      type: String,
      required: [true, "Source name is required."],
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
  { timestamps: true },
);

module.exports = mongoose.model("Sources", sourcesSchema);
