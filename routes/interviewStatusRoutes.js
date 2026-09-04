const express = require("express");
const router = express.Router();
const {
  createInterviewStatus,
  getInterviewStatuses,
  getInterviewStatusById,
  updateInterviewStatus,
  deleteInterviewStatus,
} = require("../contollers/interviewStatusController");

const auth = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");

// Retrieve interview statuses (accessible to all authenticated users, i.e. hr and superadmin)
router.get("/", auth, getInterviewStatuses);
router.get("/:id", auth, getInterviewStatusById);

// Write actions: Create, Update, Delete (restricted to superadmin only)
router.post("/", auth, checkRole("superadmin"), createInterviewStatus);
router.patch("/:id", auth, checkRole("superadmin"), updateInterviewStatus);
router.delete("/:id", auth, checkRole("superadmin"), deleteInterviewStatus);

module.exports = router;
