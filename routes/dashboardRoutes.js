const express = require("express");
const router = express.Router();
const { getDashboardStats, getDispositionBreakdown, getCompanyDesignationStatusReport, getCandidateDetailsReport, getHrCompanyStatusReport, exportCompanyDesignationStatusReport, exportCandidateDetailsReport, exportHrCompanyStatusReport } = require("../contollers/dashboardController");
const auth = require("../middleware/authMiddleware");

router.get("/stats", auth, getDashboardStats);
router.get("/disposition-breakdown", auth, getDispositionBreakdown);
router.get("/company-designation-report", auth, getCompanyDesignationStatusReport);
router.get("/candidate-details-report", auth, getCandidateDetailsReport);
router.get("/hr-company-status-report", auth, getHrCompanyStatusReport);
router.get("/company-designation-report/export", auth, exportCompanyDesignationStatusReport);
router.get("/candidate-details-report/export", auth, exportCandidateDetailsReport);
router.get("/hr-company-status-report/export", auth, exportHrCompanyStatusReport);

module.exports = router;
