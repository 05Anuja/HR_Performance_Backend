const mongoose = require("mongoose");

const silgateSchema = new mongoose.Schema(
  {
    hrId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    candidateName: { type: String, required: true },
    candidatePhone: {
      type: String,
      unique: true,
      required: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid 10-digit mobile number!`,
      },
    },
    candidateLocation: { type: String },
    language: { type: String, required: true },
    disposition: {
      type: String,
      required: true,
      // enum: ["Interested Lineup", "Not Interested", "No Contact", "Call Back"]
    },
    source: {
      type: String,
      required: true,
      // enum: ["Work India", "Reference"]
    },
    candidateDesignation: {
      type: String,
      required: true,
    },
    resumeStatus: {
      type: String,
      required: true,
      enum: ["Sent", "Not Sent"],
    },
    experience: {
      type: String,
      required: true,
      enum: ["Experienced", "Fresher"],
    },
    // NEW FIELDS
    resumeFileName: { type: String },
    resumeOriginalName: { type: String },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: "List" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Silgate", silgateSchema);
