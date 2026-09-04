const express = require("express");
const router = express.Router();

const { getAuditLogs } = require("../contollers/auditLogController");
const auth = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");

router.get("/", auth, checkRole("superadmin", "hr"), getAuditLogs);

module.exports = router;
