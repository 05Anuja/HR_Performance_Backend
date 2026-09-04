const express = require("express");
const router = express.Router();
const {
  addTalent,
  getMyTalentData,
  getAllTalentData,
  updateTalent,
  exportTalent,
  downloadResume,
  assignTalentCorner
} = require("../contollers/talentController");
const auth = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");
const uploadResume = require("../middleware/uploadResume");

router.post("/add", auth, uploadResume.single("resume"), addTalent);
router.get("/myData", auth, getMyTalentData);
router.get("/allData", auth, checkRole("superadmin", "hr"), getAllTalentData);
router.patch("/update/:id", auth, uploadResume.single("resume"), updateTalent);
router.get("/export", auth, exportTalent);
router.get("/:id/resume", auth, downloadResume);

router.patch("/assign", auth, assignTalentCorner);

module.exports = router;