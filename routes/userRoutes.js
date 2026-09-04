const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");
const {
  createHR,
  getAllHR,
  updateAllHRs,
  deleteHR,
  getProfile,
  updateProfile,
} = require("../contollers/userController");

// Self-service profile routes (accessible to any authenticated user)
router.get("/profile", authMiddleware, getProfile);
router.patch("/profile", authMiddleware, updateProfile);

// All user management routes require the user to be authenticated and have the 'superadmin' role
router.post("/createHR", authMiddleware, checkRole("superadmin"), createHR);
router.get("/allHR", authMiddleware, checkRole("superadmin", "hr"), getAllHR);
router.patch("/updateAllHr/:id", authMiddleware, checkRole("superadmin"), updateAllHRs);
router.delete("/delete/:id", authMiddleware, checkRole("superadmin"), deleteHR);

module.exports = router;
