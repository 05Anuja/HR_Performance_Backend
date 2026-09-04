const express = require("express");
const router = express.Router();
const {
  addSilgate,
  getMySilgateData,
  getAllSilgateData,
  updateSilgate,
  exportSilgate,
  downloadResume
} = require("../contollers/silgateController");
const auth = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");
const uploadResume = require("../middleware/uploadResume");

router.post("/add", auth, uploadResume.single("resume"), addSilgate);
router.get("/myData", auth, getMySilgateData);
router.get("/allData", auth, checkRole("superadmin"), getAllSilgateData);
router.patch("/update/:id", auth, uploadResume.single("resume"), updateSilgate);
router.put("/update/:id", auth, uploadResume.single("resume"), updateSilgate);
router.get("/export", auth, exportSilgate);
router.get("/:id/resume", auth, downloadResume);

module.exports = router;