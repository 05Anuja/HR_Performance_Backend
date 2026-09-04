const express = require("express");
const router = express.Router();
const {
  createDesignation,
  getDesignations,
  getDesignationById,
  updateDesignation,
  deleteDesignation,
} = require("../contollers/designationController");

const auth = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");

// Retrieve designations (accessible to all authenticated users, i.e. hr and superadmin)
router.get("/", auth, getDesignations);
router.get("/:id", auth, getDesignationById);

// Write actions: Create, Update, Delete (restricted to superadmin only)
router.post("/", auth, checkRole("superadmin"), createDesignation);
router.patch("/:id", auth, checkRole("superadmin"), updateDesignation);
router.delete("/:id", auth, checkRole("superadmin"), deleteDesignation);

module.exports = router;
