const express = require("express");
const router = express.Router();
const {
  createSource,
  getSources,
  getSourceById,
  updateSource,
  deleteSource,
} = require("../contollers/sourcesController");

const auth = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");

// Retrieve sources (accessible to all authenticated users, i.e. hr and superadmin)
router.get("/", auth, getSources);
router.get("/:id", auth, getSourceById);

// Write actions: Create, Update, Delete (restricted to superadmin only)
router.post("/", auth, checkRole("superadmin"), createSource);
router.patch("/:id", auth, checkRole("superadmin"), updateSource);
router.delete("/:id", auth, checkRole("superadmin"), deleteSource);

module.exports = router;
