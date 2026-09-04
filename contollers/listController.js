const List = require("../models/List");
const Silgate = require("../models/Silgate");
const TalentCorner = require("../models/TalentCorner");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const parseLeadFile = require("../utils/parseLeadFile");
const mongoose = require("mongoose");
const fs = require("fs");

const VALID_CAMPAIGNS = ["talentCorner", "silgate", "Talent Corner", "Silgate"];

/**
 * @desc    Create a new lead list
 * @route   POST /api/lists
 * @access  Private (Authenticated users)
 */
exports.createList = async (req, res) => {
  try {
    const { name, description, campaign, user_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "List name is required." });
    }

    if (!campaign || !campaign.trim()) {
      return res.status(400).json({ message: "Campaign is required." });
    }

    // Validate campaign value against allowed campaigns
    const isValidCampaign = VALID_CAMPAIGNS.some(
      (c) => c.toLowerCase() === campaign.trim().toLowerCase(),
    );
    if (!isValidCampaign) {
      return res.status(400).json({
        message: `Invalid campaign '${campaign}'. Allowed values: talentCorner, silgate, Talent Corner, Silgate.`,
      });
    }

    // Validate user_id if provided
    if (user_id && !mongoose.Types.ObjectId.isValid(user_id)) {
      return res.status(400).json({ message: "Invalid user_id format." });
    }

    const newList = await List.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      campaign: campaign.trim(),
      user_id: user_id || null,
      createdBy: req.user.id,
    });

    const populatedList = await List.findById(newList._id)
      .populate("user_id", "name email role")
      .populate("createdBy", "name email role");

    // Record Audit Log
    await AuditLog.create({
      action: "CREATE_LIST",
      details: `Lead List '${newList.name}' (Campaign: '${newList.campaign}') created by user '${req.user.name}'.`,
      performedBy: req.user.id,

      // ListID
      listId: newList._Id,
    });

    res.status(201).json({
      message: "List created successfully.",
      data: populatedList,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get all lead lists (with search, filtering, and pagination)
 * @route   GET /api/lists
 * @access  Private (Authenticated users)
 */
exports.getLists = async (req, res) => {
  try {
    const { campaign, user_id, search, page = 1, limit = 10 } = req.query;

    const query = {};

    if (campaign) {
      query.campaign = new RegExp(`^${campaign.trim()}$`, "i");
    }

    if (user_id) {
      if (!mongoose.Types.ObjectId.isValid(user_id)) {
        return res.status(400).json({ message: "Invalid user_id filter." });
      }
      query.user_id = user_id;
    }

    if (search) {
      query.name = new RegExp(search.trim(), "i");
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const totalLists = await List.countDocuments(query);
    const lists = await List.find(query)
      .populate("user_id", "name email role")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      data: lists,
      currentPage: pageNum,
      totalPages: Math.ceil(totalLists / limitNum) || 1,
      totalLists,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get a single lead list by ID
 * @route   GET /api/lists/:id
 * @access  Private (Authenticated users)
 */
exports.getListById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid list ID format." });
    }

    const listDoc = await List.findById(id)
      .populate("user_id", "name email role")
      .populate("createdBy", "name email role");

    if (!listDoc) {
      return res.status(404).json({ message: "List not found." });
    }

    res.status(200).json({ data: listDoc });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update a lead list
 * @route   PATCH /api/lists/:id or PUT /api/lists/:id
 * @access  Private (Owner or Superadmin)
 */
exports.updateList = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, campaign, user_id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid list ID format." });
    }

    const listDoc = await List.findById(id);
    if (!listDoc) {
      return res.status(404).json({ message: "List not found." });
    }

    // Role check: HR users can only update lists they created, superadmin can update any
    if (
      req.user.role !== "superadmin" &&
      listDoc.createdBy &&
      listDoc.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "Forbidden. You do not have permission to update this list.",
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: "List name cannot be empty." });
      }
      listDoc.name = name.trim();
    }

    if (description !== undefined) {
      listDoc.description = description ? description.trim() : "";
    }

    if (campaign !== undefined) {
      if (!campaign.trim()) {
        return res.status(400).json({ message: "Campaign cannot be empty." });
      }
      const isValidCampaign = VALID_CAMPAIGNS.some(
        (c) => c.toLowerCase() === campaign.trim().toLowerCase(),
      );
      if (!isValidCampaign) {
        return res.status(400).json({
          message: `Invalid campaign '${campaign}'. Allowed values: talentCorner, silgate, Talent Corner, Silgate.`,
        });
      }
      listDoc.campaign = campaign.trim();
    }

    if (user_id !== undefined) {
      if (user_id && !mongoose.Types.ObjectId.isValid(user_id)) {
        return res.status(400).json({ message: "Invalid user_id format." });
      }
      listDoc.user_id = user_id || null;
    }

    await listDoc.save();

    const updatedList = await List.findById(id)
      .populate("user_id", "name email role")
      .populate("createdBy", "name email role");

    // Audit Log
    await AuditLog.create({
      action: "UPDATE_LIST",
      details: `Lead List id '${listDoc._id}' ('${listDoc.name}') updated by user '${req.user.name}'.`,
      performedBy: req.user.id,

      // List_ID
      listId: listDoc._id,
    });

    res.status(200).json({
      message: "List updated successfully.",
      data: updatedList,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete a lead list
 * @route   DELETE /api/lists/:id
 * @access  Private (Owner or Superadmin)
 */
exports.deleteList = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid list ID format." });
    }

    const listDoc = await List.findById(id);
    if (!listDoc) {
      return res.status(404).json({ message: "List not found." });
    }

    // Role check: HR users can only delete lists they created, superadmin can delete any
    if (
      req.user.role !== "superadmin" &&
      listDoc.createdBy &&
      listDoc.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "Forbidden. You do not have permission to delete this list.",
      });
    }

    await List.findByIdAndDelete(id);

    // Audit Log
    await AuditLog.create({
      action: "DELETE_LIST",
      details: `Lead List '${listDoc.name}' (ID: ${listDoc._id}) was deleted by user '${req.user.name}'.`,
      performedBy: req.user.id,

      // List DOC ID
      listId: listDoc._id,
    });

    res.status(200).json({ message: "List deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Upload & distribute leads from CSV/Excel file into campaign collection (Silgate or Talent Corner)
 * @route   POST /api/lists/import
 * @access  Private (Authenticated users)
 */
exports.uploadAndDistribute = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ message: "Lead file (.csv or .xlsx) is required." });
  }

  const filePath = req.file.path;

  try {
    const {
      listId: providedListId,
      selectedUserIds,
      assignedTo,
      leadsource,
      source,
      skipDuplicates,
    } = req.body;
    const listId = providedListId || req.body.listId || req.params.id;
    const shouldSkipDuplicates =
      skipDuplicates === true || skipDuplicates === "true";

    if (!listId || !mongoose.Types.ObjectId.isValid(listId)) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ message: "A valid listId is required." });
    }

    const list = await List.findById(listId);
    if (!list) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(404).json({ message: "Lead List not found." });
    }

    const campaign = list.campaign;
    if (!campaign) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({
        message:
          "This list has no campaign attached. Please update the list with a campaign first.",
      });
    }

    // Parse CSV or Excel file
    const leadsArray = await parseLeadFile(filePath);
    if (!leadsArray || leadsArray.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res
        .status(400)
        .json({ message: "The uploaded file contains no data rows." });
    }

    const campaignNormalized = campaign.toLowerCase().replace(/[\s_]+/g, "");
    let TargetModel = null;
    if (campaignNormalized.includes("silgate")) {
      TargetModel = Silgate;
    } else if (
      campaignNormalized.includes("talent") ||
      campaignNormalized.includes("corner")
    ) {
      TargetModel = TalentCorner;
    } else {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({
        message: `Unsupported campaign type '${campaign}'. Leads can only be imported to 'Silgate' or 'Talent Corner'.`,
      });
    }

    // Phase 1: Validate phone format and check intra-file duplicate phones
    const filePhoneMap = new Map();
    const uniquePhonesFromFile = new Set();
    const rowsToProcess = [];
    const duplicateRecords = [];
    let intraFileDuplicatesCount = 0;

    for (const [index, lead] of leadsArray.entries()) {
      const rowNum = index + 2;
      const rawPhone = String(
        lead.candidatePhone ||
          lead.candidatephone ||
          lead.phone ||
          lead.mobile ||
          lead.contact ||
          "",
      ).replace(/\D/g, "");

      if (!rawPhone || rawPhone.length !== 10) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({
          message: `Invalid or missing 10-digit mobile number at row ${rowNum} (${lead.candidatePhone || lead.phone || "empty"}).`,
        });
      }

      if (filePhoneMap.has(rawPhone)) {
        const originalRow = filePhoneMap.get(rawPhone);
        duplicateRecords.push({
          phone: rawPhone,
          rowNum,
          type: "file",
          details: `Duplicate in uploaded file (first seen at row ${originalRow})`,
        });
        intraFileDuplicatesCount++;
        continue;
      }

      filePhoneMap.set(rawPhone, rowNum);
      uniquePhonesFromFile.add(rawPhone);
      rowsToProcess.push({ lead, rawPhone, rowNum });
    }

    // Phase 2: Check database duplicate phones
    const phonesToCheck = Array.from(uniquePhonesFromFile);
    const existingDbDocs = await TargetModel.find({
      candidatePhone: { $in: phonesToCheck },
    }).select("candidatePhone");

    const existingDbPhonesSet = new Set(
      existingDbDocs.map((doc) => doc.candidatePhone),
    );
    let dbDuplicatesCount = 0;
    const finalLeadsToInsert = [];

    for (const item of rowsToProcess) {
      if (existingDbPhonesSet.has(item.rawPhone)) {
        duplicateRecords.push({
          phone: item.rawPhone,
          rowNum: item.rowNum,
          type: "database",
          details: "Already exists in database",
        });
        dbDuplicatesCount++;
        continue;
      }
      finalLeadsToInsert.push(item);
    }

    const skippedCount = intraFileDuplicatesCount + dbDuplicatesCount;

    // If duplicates exist and skipDuplicates is false (default behavior), reject with detailed message
    if (!shouldSkipDuplicates && duplicateRecords.length > 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      const duplicateSummary = duplicateRecords
        .map(
          (d) =>
            `Row ${d.rowNum} (${d.phone}): ${
              d.type === "file"
                ? `duplicate in file (first seen at row ${filePhoneMap.get(d.phone)})`
                : "already exists in database"
            }`,
        )
        .join("; ");

      return res.status(400).json({
        message: `Duplicate lead(s) found: ${duplicateSummary}.`,
        duplicateCount: duplicateRecords.length,
        duplicates: duplicateRecords,
      });
    }

    // Parse user selection for distribution
    let userIds = [];
    if (selectedUserIds) {
      if (Array.isArray(selectedUserIds)) {
        userIds = selectedUserIds;
      } else if (typeof selectedUserIds === "string") {
        try {
          userIds = JSON.parse(selectedUserIds);
        } catch (e) {
          userIds = selectedUserIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }

    let selectedUsers = [];
    if (userIds.length > 0) {
      selectedUsers = await User.find({ _id: { $in: userIds } }).select(
        "_id name email role",
      );
      if (!selectedUsers.length) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(404).json({ message: "Selected users not found." });
      }
    }

    let assignedUserId = null;
    if (assignedTo !== undefined && assignedTo !== null && assignedTo !== "") {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ message: "Invalid assignedTo user ID." });
      }

      const assignedUser = await User.findOne({
        _id: assignedTo,
        role: "hr",
      }).select("_id");
      if (!assignedUser) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(404).json({
          message: "The assignedTo user was not found or is not an HR user.",
        });
      }
      assignedUserId = assignedUser._id;
    }

    const effectiveSource = leadsource || source || "File Upload";
    let userIndex = 0;
    const isAutoDistribute = selectedUsers.length > 0;

    const getAssignedUserId = () => {
      if (isAutoDistribute) {
        const user = selectedUsers[userIndex];
        userIndex = (userIndex + 1) % selectedUsers.length;
        return user._id;
      }
      return list.user_id || req.user.id;
    };

    let insertedDocs = [];

    // CAMPAIGN 1: SILGATE
    if (campaignNormalized.includes("silgate")) {
      const newLeads = [];

      for (const { lead, rawPhone, rowNum } of finalLeadsToInsert) {
        const candidateName =
          lead.candidateName ||
          lead.candidatename ||
          lead.name ||
          lead.candidate ||
          "";
        if (!candidateName || !candidateName.trim()) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return res.status(400).json({
            message: `Candidate Name is required at row ${rowNum} for Silgate.`,
          });
        }

        const candidateDesignation =
          lead.candidateDesignation ||
          lead.candidatedesignation ||
          lead.designation ||
          lead.role ||
          "";
        if (!candidateDesignation || !candidateDesignation.trim()) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return res.status(400).json({
            message: `Candidate Designation is required at row ${rowNum} for Silgate.`,
          });
        }

        const language = lead.language || lead.lang || "Hindi";
        const disposition = lead.disposition || "New Lead";
        const candidateLocation =
          lead.candidateLocation ||
          lead.candidatelocation ||
          lead.location ||
          lead.city ||
          "";
        const itemSource = lead.source || effectiveSource;
        const resumeStatus = ["Sent", "Not Sent"].includes(
          lead.resumeStatus || lead.resumestatus,
        )
          ? lead.resumeStatus || lead.resumestatus
          : "Not Sent";

        newLeads.push({
          hrId: getAssignedUserId(),
          assignedTo: assignedUserId,
          candidateName: candidateName.trim(),
          candidatePhone: rawPhone,
          candidateLocation: candidateLocation ? candidateLocation.trim() : "",
          language: language.trim(),
          disposition: disposition.trim(),
          source: itemSource.trim(),
          candidateDesignation: candidateDesignation.trim(),
          resumeStatus,
          listId: list._id,
        });
      }

      if (newLeads.length > 0) {
        insertedDocs = await Silgate.insertMany(newLeads);
      }
    }
    // CAMPAIGN 2: TALENT CORNER
    else if (
      campaignNormalized.includes("talent") ||
      campaignNormalized.includes("corner")
    ) {
      const newLeads = [];

      for (const { lead, rawPhone, rowNum } of finalLeadsToInsert) {
        const candidateDesignation =
          lead.candidateDesignation ||
          lead.candidatedesignation ||
          lead.designation ||
          lead.role ||
          "";
        if (!candidateDesignation || !candidateDesignation.trim()) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return res.status(400).json({
            message: `Candidate Designation is required at row ${rowNum} for Talent Corner.`,
          });
        }

        const candidateName =
          lead.candidateName || lead.candidatename || lead.name || "";
        const candidateLocation =
          lead.candidateLocation ||
          lead.candidatelocation ||
          lead.location ||
          lead.city ||
          "";
        const companyName =
          lead.companyName || lead.companyname || lead.company || "";
        const interviewStatus =
          lead.interviewStatus || lead.interviewstatus || lead.status || "";
        const itemSource = lead.source || effectiveSource;
        const resumeStatus = ["Sent", "Not Sent"].includes(
          lead.resumeStatus || lead.resumestatus,
        )
          ? lead.resumeStatus || lead.resumestatus
          : "Not Sent";

        newLeads.push({
          hrId: getAssignedUserId(),
          assignedTo: assignedUserId,
          candidateName: candidateName ? candidateName.trim() : "",
          candidatePhone: rawPhone,
          candidateLocation: candidateLocation ? candidateLocation.trim() : "",
          candidateDesignation: candidateDesignation.trim(),
          source: itemSource ? itemSource.trim() : "",
          companyName: companyName ? companyName.trim() : "",
          interviewStatus: interviewStatus ? interviewStatus.trim() : "",
          resumeStatus,
          listId: list._id,
        });
      }

      if (newLeads.length > 0) {
        insertedDocs = await TalentCorner.insertMany(newLeads);
      }
    }

    // Clean up uploaded temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Record Audit Log
    await AuditLog.create({
      action: "UPLOAD_LEADS",
      details: `${insertedDocs.length} lead(s) uploaded from CSV/Excel for campaign '${campaign}' under list '${list.name}' by user '${req.user.name}' (${skippedCount} duplicate(s) skipped).`,
      performedBy: req.user.id,
      listId: list._id,
    });

    const duplicateSummary =
      duplicateRecords.length > 0
        ? ` ${duplicateRecords.length} duplicate lead(s) skipped: ` +
          duplicateRecords
            .map(
              (d) =>
                `Row ${d.rowNum} (${d.phone}): ${
                  d.type === "file"
                    ? `duplicate in file (first seen at row ${filePhoneMap.get(d.phone)})`
                    : "already exists in database"
                }`,
            )
            .join("; ")
        : "";

    res.status(201).json({
      success: true,
      message: `${insertedDocs.length} lead(s) imported successfully into "${campaign}" collection in ${
        isAutoDistribute
          ? `Auto Distribution Mode across ${selectedUsers.length} user(s)`
          : "Single User Mode"
      }.${duplicateSummary}`,
      insertedCount: insertedDocs.length,
      skippedCount,
      duplicates: duplicateRecords,
      campaign,
      data: insertedDocs,
    });
  } catch (err) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Download a sample lead CSV file with correct headers for a campaign
 * @route   GET /api/lists/sample (Query: campaign=silgate or campaign=talentCorner)
 * @access  Private (Authenticated users)
 */
exports.downloadSampleFile = async (req, res) => {
  try {
    const campaignInput = req.params.campaign || req.query.campaign;

    if (!campaignInput || !campaignInput.trim()) {
      return res.status(400).json({
        message:
          "Campaign parameter is required (e.g. ?campaign=silgate or /sample?campaign=silgate).",
      });
    }

    const campaignNormalized = campaignInput
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "");

    const escapeCSV = (val) => {
      if (val === undefined || val === null) return "";
      const str = String(val);
      if (
        str.includes(",") ||
        str.includes('"') ||
        str.includes("\n") ||
        str.includes("\r")
      ) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    if (campaignNormalized.includes("silgate")) {
      const headers = [
        "Candidate Name",
        "Candidate Phone",
        "Candidate Location",
        "Language",
        "Disposition",
        "Source",
        "Candidate Designation",
        "Resume Status",
      ];

      let csvContent = headers.map(escapeCSV).join(",") + "\n";

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=sample_silgate_leads.csv",
      );
      return res.status(200).send(csvContent);
    } else if (
      campaignNormalized.includes("talent") ||
      campaignNormalized.includes("corner")
    ) {
      const headers = [
        "Candidate Name",
        "Candidate Phone",
        "Candidate Location",
        "Candidate Designation",
        "Source",
        "Company Name",
        "Interview Status",
        "Resume Status",
      ];

      let csvContent = headers.map(escapeCSV).join(",") + "\n";

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=sample_talent_corner_leads.csv",
      );
      return res.status(200).send(csvContent);
    } else {
      return res.status(400).json({
        message: `Unsupported campaign '${campaignInput}'. Allowed values: silgate, talentCorner.`,
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
