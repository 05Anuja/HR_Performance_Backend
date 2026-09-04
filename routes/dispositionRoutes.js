const express = require("express");
const router = express.Router();
const {
  createDisposition,
  getDispositions,
  getDispositionById,
  updateDisposition,
  deleteDisposition,
} = require("../contollers/dispositionController");

const auth = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");

// Retrieve dispositions (accessible to all authenticated users, i.e. hr and superadmin)
router.get("/", auth, getDispositions);
router.get("/:id", auth, getDispositionById);

// Write actions: Create, Update, Delete (restricted to superadmin only)
router.post("/", auth, checkRole("superadmin"), createDisposition);
router.patch("/:id", auth, checkRole("superadmin"), updateDisposition);
router.delete("/:id", auth, checkRole("superadmin"), deleteDisposition);

module.exports = router;
