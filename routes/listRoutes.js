const express = require("express");
const router = express.Router();
const {
  createList,
  getLists,
  getListById,
  updateList,
  deleteList,
  uploadAndDistribute,
  downloadSampleFile,
} = require("../contollers/listController");

const auth = require("../middleware/authMiddleware");
const uploadLeadFile = require("../middleware/uploadLeadFile");

// Download sample CSV header file for a campaign
router.get("/sample", auth, downloadSampleFile);

// Single Import Endpoint: Imports data from list to campaign collection (Silgate/TalentCorner)
router.post("/import", auth, uploadLeadFile.single("file"), uploadAndDistribute);

// Authenticated routes for Lead List CRUD
router.post("/", auth, createList);
router.get("/", auth, getLists);
router.get("/:id", auth, getListById);
router.patch("/:id", auth, updateList);
router.put("/:id", auth, updateList);
router.delete("/:id", auth, deleteList);

module.exports = router;
