const mongoose = require("mongoose");

const talentCornerSchema = new mongoose.Schema(
  {
    hrId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    candidateName: { type: String },
    candidateLocation: { type: String },
    candidateDesignation: {
      type: String,
      // required: true,
    },
    experience: {
      type: String,
      // required: true,
      enum: ["Experienced", "Fresher"],
    },
    source: {
      type: String,
    },
    candidatePhone: {
      type: String,
      required: true,
      // unique: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid 10-digit mobile number!`,
      },
    },
    companyName: {
      type: String,
    },
    interviewStatus: {
      type: String,
    },
    resumeStatus: {
      type: String,
      // required: true,
      enum: ["Sent", "Not Sent"],
    },
    // NEW FIELDS
    resumeFileName: { type: String }, // name saved on disk
    resumeOriginalName: { type: String }, // original name uploaded by HR
    listId: { type: mongoose.Schema.Types.ObjectId, ref: "List" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TalentCorner", talentCornerSchema);
