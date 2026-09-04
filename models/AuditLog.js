const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      "CREATE_PROJECT",
      "DELETE_PROJECT",
      "CREATE_FORM",
      "UPDATE_FORM",
      "DELETE_FORM",
      "CREATE_SILGATE_SUBMISSION",
      "UPDATE_SILGATE_SUBMISSION",
      "CREATE_TALENT_SUBMISSION",
      "UPDATE_TALENT_SUBMISSION",
      "CREATE_DESIGNATION",
      "UPDATE_DESIGNATION",
      "DELETE_DESIGNATION",
      "CREATE_INTERVIEW_STATUS",
      "UPDATE_INTERVIEW_STATUS",
      "DELETE_INTERVIEW_STATUS",
      "CREATE_SOURCE",
      "UPDATE_SOURCE",
      "DELETE_SOURCE",
      "CREATE_DISPOSITION",
      "UPDATE_DISPOSITION",
      "DELETE_DISPOSITION",
      "CREATE_LIST",
      "UPDATE_LIST",
      "DELETE_LIST",
      "UPLOAD_LEADS",
    ],
    required: true,
  },
  details: { type: String, required: true },
  // NEW
  // Identifies which lead list this audit log belongs to
  listId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "List",
    default: null,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
