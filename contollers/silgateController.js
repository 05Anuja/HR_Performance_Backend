const mongoose = require("mongoose");
const Silgate = require("../models/Silgate");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const Designation = require("../models/Designation");
const buildDateFilter = require("../utils/dateFilter");
const fs = require("fs");
const path = require("path");
const Sources = require("../models/Sources");
const Disposition = require("../models/Disposition");

exports.addSilgate = async (req, res) => {
  try {
    const {
      candidateName,
      candidatePhone,
      candidateLocation,
      language,
      disposition,
      source,
      candidateDesignation,
      resumeStatus,
      experience,
    } = req.body;

    const hrUser = await User.findById(req.user.id);
    if (!hrUser) {
      return res.status(404).json({ message: "HR User not found." });
    }

    if (hrUser.role === "hr" && !hrUser.projects.includes("Silgate")) {
      return res
        .status(403)
        .json({ message: "You are not assigned to the Silgate project." });
    }

    if (!candidateName || !candidateName.trim()) {
      return res.status(400).json({ message: "Candidate's Name is required." });
    }
    if (!candidatePhone || !/^\d{10}$/.test(candidatePhone)) {
      return res
        .status(400)
        .json({ message: "A valid 10-digit Candidate's Phone is required." });
    }
    if (!language || !language.trim()) {
      return res.status(400).json({ message: "Language is required." });
    }
    // if (!disposition || !["Interested Lineup", "Not Interested", "No Contact", "Call Back"].includes(disposition)) {
    //   return res.status(400).json({ message: "Invalid Disposition selection." });
    // }
    if (!disposition || !disposition.trim()) {
      return res.status(400).json({ message: "Disposition is required." });
    }
    const dispositionExists = await Disposition.findOne({
      disposition: disposition.trim(),
      project: "Silgate",
    });
    if (!dispositionExists) {
      return res.status(400).json({
        message:
          "Invalid Disposition selection. The disposition must exist and be assigned to Silgate.",
      });
    }

    // if (!source || !["Work India", "Reference"].includes(source)) {
    //   return res.status(400).json({ message: "Invalid Source selection." });
    // }
    if (source) {
      const sourceExists = await Sources.findOne({
        sourceName: source.trim(),
        project: "Silgate",
      });
      if (!sourceExists) {
        return res.status(400).json({
          message:
            "Invalid Source selection. The source must exist and be assigned to Silgate.",
        });
      }
    }
    if (!candidateDesignation || !candidateDesignation.trim()) {
      return res
        .status(400)
        .json({ message: "Candidate's Designation is required." });
    }
    if (!resumeStatus || !["Sent", "Not Sent"].includes(resumeStatus)) {
      return res
        .status(400)
        .json({ message: "Invalid Resume Status selection." });
    }

    if (!experience || !["Experienced", "Fresher"].includes(experience)) {
      return res.status(400).json({ message: "Experience is required." });
    }

    const designationExists = await Designation.findOne({
      name: candidateDesignation.trim(),
      project: "Silgate",
    });
    if (!designationExists) {
      return res.status(400).json({
        message:
          "Invalid Candidate's Designation. The designation must exist and be assigned to Silgate.",
      });
    }

    const silgateLog = await Silgate.create({
      hrId: req.user.id,
      candidateName: candidateName.trim(),
      candidatePhone,
      candidateLocation: candidateLocation ? candidateLocation.trim() : "",
      language: language.trim(),
      disposition,
      source,
      candidateDesignation,
      resumeStatus,
      experience,
      resumeFileName: req.file ? req.file.filename : undefined,
      resumeOriginalName: req.file ? req.file.originalname : undefined,
    });

    await AuditLog.create({
      action: "CREATE_SILGATE_SUBMISSION",
      details: `Silgate submission logged for candidate '${silgateLog.candidateName}' by HR '${hrUser.name}'.`,
      performedBy: req.user.id,
    });

    res.status(201).json({
      message: "Silgate record logged successfully.",
      data: silgateLog,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get HR's own Silgate submissions
exports.getMySilgateData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const dateQuery = buildDateFilter(req.query, "createdAt");
    const andConditions = [];

    if (Object.keys(dateQuery).length > 0) {
      andConditions.push(dateQuery);
    }

    if (req.user.role !== "superadmin") {
      andConditions.push({
        $or: [
          {
            hrId: req.user.id,
            $or: [
              { assignedTo: null },
              { assignedTo: { $exists: false } },
            ],
          },
          {
            assignedTo: req.user.id,
          },
        ],
      });
    } else {
      if (req.query.hrId || req.query.hr) {
        andConditions.push({ hrId: req.query.hrId || req.query.hr });
      }
      if (req.query.assignedTo) {
        andConditions.push({ assignedTo: req.query.assignedTo });
      }
    }

    if (req.query.language) {
      andConditions.push({ language: req.query.language });
    }
    if (req.query.candidateDesignation) {
      andConditions.push({ candidateDesignation: req.query.candidateDesignation });
    } else if (req.query.designation) {
      andConditions.push({ candidateDesignation: req.query.designation });
    }
    if (req.query.disposition) {
      andConditions.push({ disposition: req.query.disposition });
    }
    if (req.query.search) {
      const escapedSearch = req.query.search.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );
      andConditions.push({
        $or: [
          { candidateName: { $regex: escapedSearch, $options: "i" } },
          { candidatePhone: { $regex: escapedSearch, $options: "i" } },
          { candidateLocation: { $regex: escapedSearch, $options: "i" } },
        ],
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const total = await Silgate.countDocuments(query);
    const data = await Silgate.find(query)
      .populate("hrId", "name")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalSubmissions: total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all Silgate submissions (Superadmin only)
exports.getAllSilgateData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const dateQuery = buildDateFilter(req.query, "createdAt");
    const andConditions = [];

    if (Object.keys(dateQuery).length > 0) {
      andConditions.push(dateQuery);
    }

    if (req.query.language) {
      andConditions.push({ language: req.query.language });
    }
    if (req.query.hrId || req.query.hr) {
      andConditions.push({ hrId: req.query.hrId || req.query.hr });
    }
    if (req.query.assignedTo) {
      andConditions.push({ assignedTo: req.query.assignedTo });
    }
    if (req.query.candidateDesignation) {
      andConditions.push({ candidateDesignation: req.query.candidateDesignation });
    } else if (req.query.designation) {
      andConditions.push({ candidateDesignation: req.query.designation });
    }
    if (req.query.disposition) {
      andConditions.push({ disposition: req.query.disposition });
    }
    if (req.query.search) {
      const escapedSearch = req.query.search.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );
      andConditions.push({
        $or: [
          { candidateName: { $regex: escapedSearch, $options: "i" } },
          { candidatePhone: { $regex: escapedSearch, $options: "i" } },
          { candidateLocation: { $regex: escapedSearch, $options: "i" } },
        ],
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const total = await Silgate.countDocuments(query);
    const data = await Silgate.find(query)
      .populate("hrId", "name")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalSubmissions: total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a Silgate submission
exports.updateSilgate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      candidateName,
      candidatePhone,
      candidateLocation,
      language,
      disposition,
      source,
      candidateDesignation,
      resumeStatus,
      experience,
      assignedTo,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Silgate submission ID." });
    }

    const silgateLog = await Silgate.findById(id);
    if (!silgateLog) {
      return res.status(404).json({ message: "Silgate submission not found." });
    }

    if (req.user.role !== "superadmin") {
      const isOwner =
        silgateLog.hrId &&
        silgateLog.hrId.toString() === req.user.id &&
        !silgateLog.assignedTo;

      const isAssigned =
        silgateLog.assignedTo &&
        silgateLog.assignedTo.toString() === req.user.id;

      if (!isOwner && !isAssigned) {
        return res.status(403).json({
          message: "You are not authorized to update this submission.",
        });
      }
    }

    if (candidateName !== undefined) {
      if (!candidateName.trim()) {
        return res
          .status(400)
          .json({ message: "Candidate's Name is required." });
      }
      silgateLog.candidateName = candidateName.trim();
    }
    if (candidatePhone !== undefined) {
      if (!/^\d{10}$/.test(candidatePhone)) {
        return res
          .status(400)
          .json({ message: "A valid 10-digit Candidate's Phone is required." });
      }
      silgateLog.candidatePhone = candidatePhone;
    }
    if (candidateLocation !== undefined) {
      silgateLog.candidateLocation = candidateLocation
        ? candidateLocation.trim()
        : "";
    }
    if (language !== undefined) {
      if (!language.trim()) {
        return res.status(400).json({ message: "Language is required." });
      }
      silgateLog.language = language.trim();
    }

    if (disposition !== undefined) {
      if (!disposition || !disposition.trim()) {
        return res.status(400).json({ message: "Disposition is required." });
      }
      const dispositionExists = await Disposition.findOne({
        disposition: disposition.trim(),
        project: "Silgate",
      });
      if (!dispositionExists) {
        return res.status(400).json({
          message:
            "Invalid Disposition selection. The disposition must exist and be assigned to Silgate.",
        });
      }
      silgateLog.disposition = disposition.trim();
    }

    if (source !== undefined) {
      if (source) {
        const sourceExists = await Sources.findOne({
          sourceName: source.trim(),
          project: "Silgate",
        });
        if (!sourceExists) {
          return res.status(400).json({
            message:
              "Invalid Source selection. The source must exist and be assigned to Silgate.",
          });
        }
      }
      silgateLog.source = source || "";
    }

    if (candidateDesignation !== undefined) {
      if (!candidateDesignation.trim()) {
        return res
          .status(400)
          .json({ message: "Candidate's Designation is required." });
      }
      const designationExists = await Designation.findOne({
        name: candidateDesignation.trim(),
        project: "Silgate",
      });
      if (!designationExists) {
        return res.status(400).json({
          message:
            "Invalid Candidate's Designation. The designation must exist and be assigned to Silgate.",
        });
      }
      silgateLog.candidateDesignation = candidateDesignation.trim();
    }
    if (resumeStatus !== undefined) {
      if (!["Sent", "Not Sent"].includes(resumeStatus)) {
        return res
          .status(400)
          .json({ message: "Invalid Resume Status selection." });
      }
      silgateLog.resumeStatus = resumeStatus;
    }

    if (experience !== undefined) {
      if (!["Experienced", "Fresher"].includes(experience)) {
        return res.status(400).json({ message: "Experience is required." });
      }
      silgateLog.experience = experience;
    }

    // Assignment & Unassignment logic
    let assignmentAuditDetail = null;
    if (assignedTo !== undefined && assignedTo !== "undefined") {
      if (assignedTo === null || assignedTo === "" || assignedTo === "null") {
        if (silgateLog.assignedTo) {
          assignmentAuditDetail = "unassigned";
          silgateLog.assignedTo = null;
        }
      } else {
        if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
          return res.status(400).json({ message: "Invalid assigned HR." });
        }

        const assignedHR = await User.findById(assignedTo);
        if (!assignedHR) {
          return res.status(404).json({ message: "Assigned HR not found." });
        }

        if (assignedHR.role !== "hr") {
          return res.status(400).json({ message: "User is not an HR." });
        }

        silgateLog.assignedTo = assignedHR._id;
        assignmentAuditDetail = `assigned to HR '${assignedHR.name}'`;
      }
    }

    if (req.file) {
      if (silgateLog.resumeFileName) {
        const oldPath = path.join(
          __dirname,
          "..",
          "uploads",
          "resumes",
          silgateLog.resumeFileName,
        );
        fs.unlink(oldPath, (err) => {
          if (err && err.code !== "ENOENT")
            console.error("Failed to delete old resume:", err);
        });
      }
      silgateLog.resumeFileName = req.file.filename;
      silgateLog.resumeOriginalName = req.file.originalname;
    }

    await silgateLog.save();

    let auditDetails = `Silgate submission id '${silgateLog._id}' was updated by '${req.user.role}'.`;
    if (assignmentAuditDetail) {
      auditDetails = `Silgate submission id '${silgateLog._id}' was ${assignmentAuditDetail} by '${req.user.role}'.`;
    }

    await AuditLog.create({
      action: "UPDATE_SILGATE_SUBMISSION",
      details: auditDetails,
      performedBy: req.user.id,
      listId: silgateLog.listId || null,
    });

    await silgateLog.populate([
      { path: "hrId", select: "name" },
      { path: "assignedTo", select: "name" },
    ]);

    res.status(200).json({
      message: "Silgate submission updated successfully.",
      data: silgateLog,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download resume
exports.downloadResume = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Silgate submission ID." });
    }
    const silgateLog = await Silgate.findById(id);
    if (!silgateLog || !silgateLog.resumeFileName) {
      return res.status(404).json({ message: "Resume not found." });
    }

    if (req.user.role !== "superadmin") {
      const isOwner =
        silgateLog.hrId &&
        silgateLog.hrId.toString() === req.user.id &&
        !silgateLog.assignedTo;

      const isAssigned =
        silgateLog.assignedTo &&
        silgateLog.assignedTo.toString() === req.user.id;

      if (!isOwner && !isAssigned) {
        return res
          .status(403)
          .json({ message: "You are not authorized to view this resume." });
      }
    }

    const filePath = path.join(
      __dirname,
      "..",
      "uploads",
      "resumes",
      silgateLog.resumeFileName,
    );
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "Resume file missing on server." });
    }

    res.download(filePath, silgateLog.resumeOriginalName || "resume.pdf");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Export Silgate submissions as CSV
exports.exportSilgate = async (req, res) => {
  try {
    if (req.user.role === "hr") {
      const hrUser = await User.findById(req.user.id);
      if (!hrUser || !hrUser.projects.includes("Silgate")) {
        return res
          .status(403)
          .json({ message: "You are not assigned to the Silgate project." });
      }
    }

    const dateQuery = buildDateFilter(req.query, "createdAt");
    const andConditions = [];

    if (Object.keys(dateQuery).length > 0) {
      andConditions.push(dateQuery);
    }

    if (req.user.role !== "superadmin") {
      andConditions.push({
        $or: [
          {
            hrId: req.user.id,
            $or: [
              { assignedTo: null },
              { assignedTo: { $exists: false } },
            ],
          },
          {
            assignedTo: req.user.id,
          },
        ],
      });
    } else {
      if (req.query.hrId || req.query.hr) {
        andConditions.push({ hrId: req.query.hrId || req.query.hr });
      }
      if (req.query.assignedTo) {
        andConditions.push({ assignedTo: req.query.assignedTo });
      }
    }

    if (req.query.language) {
      andConditions.push({ language: req.query.language });
    }
    if (req.query.candidateDesignation) {
      andConditions.push({ candidateDesignation: req.query.candidateDesignation });
    } else if (req.query.designation) {
      andConditions.push({ candidateDesignation: req.query.designation });
    }
    if (req.query.disposition) {
      andConditions.push({ disposition: req.query.disposition });
    }
    if (req.query.search) {
      const escapedSearch = req.query.search.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );
      andConditions.push({
        $or: [
          { candidateName: { $regex: escapedSearch, $options: "i" } },
          { candidatePhone: { $regex: escapedSearch, $options: "i" } },
          { candidateLocation: { $regex: escapedSearch, $options: "i" } },
        ],
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const submissions = await Silgate.find(query)
      .populate("hrId", "name")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

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

    const headers = [
      "Candidate Name",
      "Candidate Phone",
      "Candidate Location",
      "Language",
      "Disposition",
      "Source",
      "Candidate Designation",
      "Resume Status",
      "Experience",
      "Resume File",
      "Submitted By",
      "Assigned To",
      "Created At",
    ];

    let csvContent = headers.join(",") + "\n";

    for (const sub of submissions) {
      const row = [
        escapeCSV(sub.candidateName),
        escapeCSV(sub.candidatePhone),
        escapeCSV(sub.candidateLocation),
        escapeCSV(sub.language),
        escapeCSV(sub.disposition),
        escapeCSV(sub.source),
        escapeCSV(sub.candidateDesignation),
        escapeCSV(sub.resumeStatus),
        escapeCSV(sub.experience),
        escapeCSV(sub.resumeOriginalName || ""),
        escapeCSV(sub.hrId ? sub.hrId.name : "Unknown"),
        escapeCSV(sub.assignedTo ? sub.assignedTo.name : "Unassigned"),
        escapeCSV(sub.createdAt.toISOString()),
      ];
      csvContent += row.join(",") + "\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=silgate_submissions.csv",
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
