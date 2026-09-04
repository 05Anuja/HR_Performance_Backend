const TalentCorner = require("../models/TalentCorner");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const Designation = require("../models/Designation");
const buildDateFilter = require("../utils/dateFilter");
const fs = require("fs");
const path = require("path");
const Sources = require("../models/Sources");
const InterviewStatus = require("../models/InterviewStatus");

// Add Talent Corner submission
exports.addTalent = async (req, res) => {
  console.log("RAW req.body:", req.body);
  try {
    const {
      candidateName,
      candidateLocation,
      candidateDesignation,
      source,
      candidatePhone,
      resumeStatus,
      experience,
      companyName,
      interviewStatus,
    } = req.body;

    console.log(
      candidateName,
      candidateLocation,
      candidateDesignation,
      source,
      candidatePhone,
      resumeStatus,
      experience,
      companyName,
      interviewStatus,
    );

    const hrUser = await User.findById(req.user.id);
    if (!hrUser) {
      return res.status(404).json({ message: "HR User not found." });
    }

    if (hrUser.role === "hr" && !hrUser.projects.includes("Talent Corner")) {
      return res.status(403).json({
        message: "You are not assigned to the Talent Corner project.",
      });
    }

    if (!candidateDesignation || !candidateDesignation.trim()) {
      return res
        .status(400)
        .json({ message: "Candidate's Designation is required." });
    }

    const designationExists = await Designation.findOne({
      name: candidateDesignation.trim(),
      project: "Talent Corner",
    });
    if (!designationExists) {
      return res.status(400).json({
        message:
          "Invalid Candidate's Designation. The designation must exist and be assigned to Talent Corner.",
      });
    }

    // if (source && !["Indeed", "Linkedin", "Naukri", "Work India", "Reference"].includes(source)) {
    //   return res.status(400).json({ message: "Invalid Source selection." });
    // }
    if (source) {
      const sourceExists = await Sources.findOne({
        sourceName: source.trim(),
        project: "Talent Corner",
      });
      if (!sourceExists) {
        return res.status(400).json({
          message:
            "Invalid Source selection. The source must exist and be assigned to Talent Corner.",
        });
      }
    }

    if (interviewStatus) {
      const statusExists = await InterviewStatus.findOne({
        interviewStatus: interviewStatus.trim(),
        project: "Talent Corner",
      });
      if (!statusExists) {
        return res.status(400).json({
          message:
            "Invalid Interview Status. The status must exist and be assigned to Talent Corner.",
        });
      }
    }

    if (!candidatePhone || !/^\d{10}$/.test(candidatePhone)) {
      return res
        .status(400)
        .json({ message: "A valid 10-digit Candidate's Phone is required." });
    }
    if (!resumeStatus || !["Sent", "Not Sent"].includes(resumeStatus)) {
      return res
        .status(400)
        .json({ message: "Invalid Resume Status selection." });
    }

    if (!experience || !["Experienced", "Fresher"].includes(experience)) {
      return res.status(400).json({ message: "Experience is required." });
    }

    const talentLog = await TalentCorner.create({
      hrId: req.user.id,
      candidateName: candidateName ? candidateName.trim() : "",
      candidateLocation: candidateLocation ? candidateLocation.trim() : "",
      candidateDesignation,
      source,
      candidatePhone,
      companyName: companyName ? companyName.trim() : "",
      interviewStatus: interviewStatus ? interviewStatus.trim() : "",
      resumeStatus,
      experience,
      resumeFileName: req.file ? req.file.filename : undefined,
      resumeOriginalName: req.file ? req.file.originalname : undefined,
    });

    console.log(talentLog);

    await AuditLog.create({
      action: "CREATE_TALENT_SUBMISSION",
      details: `Talent Corner submission logged for candidate '${talentLog.candidateName || "N/A"}' by HR '${hrUser.name}'.`,
      performedBy: req.user.id,
    });

    res.status(201).json({
      message: "Talent Corner record logged successfully.",
      data: talentLog,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get HR's own Talent Corner submissions
exports.getMyTalentData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const dateQuery = buildDateFilter(req.query, "createdAt");
    const query = { hrId: req.user.id, ...dateQuery };

    if (req.query.candidateDesignation) {
      query.candidateDesignation = req.query.candidateDesignation;
    } else if (req.query.designation) {
      query.candidateDesignation = req.query.designation;
    }
    if (req.query.search) {
      const escapedSearch = req.query.search.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );
      query.$or = [
        { candidateName: { $regex: escapedSearch, $options: "i" } },
        { candidatePhone: { $regex: escapedSearch, $options: "i" } },
        { candidateLocation: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const total = await TalentCorner.countDocuments(query);
    const data = await TalentCorner.find(query)
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

// Get all Talent Corner submissions (Superadmin only)
exports.getAllTalentData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const dateQuery = buildDateFilter(req.query, "createdAt");
    const query = { ...dateQuery };

    if (req.query.hrId || req.query.hr) {
      query.hrId = req.query.hrId || req.query.hr;
    }
    if (req.query.candidateDesignation) {
      query.candidateDesignation = req.query.candidateDesignation;
    } else if (req.query.designation) {
      query.candidateDesignation = req.query.designation;
    }
    if (req.query.search) {
      const escapedSearch = req.query.search.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );
      query.$or = [
        { candidateName: { $regex: escapedSearch, $options: "i" } },
        { candidatePhone: { $regex: escapedSearch, $options: "i" } },
        { candidateLocation: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const total = await TalentCorner.countDocuments(query);
    const data = await TalentCorner.find(query)
      .populate("hrId", "name")
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

// Update a Talent Corner submission
exports.updateTalent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      candidateName,
      candidateLocation,
      candidateDesignation,
      source,
      candidatePhone,
      companyName,
      interviewStatus,
      resumeStatus,
      experience,
    } = req.body;

    // console.log(candidateName,
    //   candidateLocation,
    //   candidateDesignation,
    //   source,
    //   candidatePhone,
    //   companyName,
    //   interviewStatus,
    //   resumeStatus);

    const talentLog = await TalentCorner.findById(id);
    if (!talentLog) {
      return res
        .status(404)
        .json({ message: "Talent Corner submission not found." });
    }

    if (
      req.user.role !== "superadmin" &&
      talentLog.hrId.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this submission." });
    }

    if (candidateName !== undefined) {
      talentLog.candidateName = candidateName ? candidateName.trim() : "";
    }
    if (candidateLocation !== undefined) {
      talentLog.candidateLocation = candidateLocation
        ? candidateLocation.trim()
        : "";
    }
    if (candidateDesignation !== undefined) {
      if (!candidateDesignation.trim()) {
        return res
          .status(400)
          .json({ message: "Candidate's Designation is required." });
      }
      const designationExists = await Designation.findOne({
        name: candidateDesignation.trim(),
        project: "Talent Corner",
      });
      if (!designationExists) {
        return res.status(400).json({
          message:
            "Invalid Candidate's Designation. The designation must exist and be assigned to Talent Corner.",
        });
      }
      talentLog.candidateDesignation = candidateDesignation.trim();
    }
    // if (source !== undefined) {
    //   if (source && !["Indeed", "Linkedin", "Naukri", "Work India", "Reference"].includes(source)) {
    //     return res.status(400).json({ message: "Invalid Source selection." });
    //   }
    //   talentLog.source = source || "";
    // }
    if (source !== undefined) {
      if (source) {
        const sourceExists = await Sources.findOne({
          sourceName: source.trim(),
          project: "Talent Corner",
        });
        if (!sourceExists) {
          return res.status(400).json({
            message:
              "Invalid Source selection. The source must exist and be assigned to Talent Corner.",
          });
        }
      }
      talentLog.source = source || "";
    }

    if (candidatePhone !== undefined) {
      if (!/^\d{10}$/.test(candidatePhone)) {
        return res
          .status(400)
          .json({ message: "A valid 10-digit Candidate's Phone is required." });
      }
      talentLog.candidatePhone = candidatePhone;
    }
    if (companyName !== undefined) {
      talentLog.companyName = companyName ? companyName.trim() : "";
    }

    // if (interviewStatus !== undefined) {
    //   talentLog.interviewStatus = interviewStatus ? interviewStatus.trim() : "";
    // }
    if (interviewStatus !== undefined) {
      if (interviewStatus) {
        const statusExists = await InterviewStatus.findOne({
          interviewStatus: interviewStatus.trim(),
          project: "Talent Corner",
        });
        if (!statusExists) {
          return res.status(400).json({
            message:
              "Invalid Interview Status. The status must exist and be assigned to Talent Corner.",
          });
        }
      }
      talentLog.interviewStatus = interviewStatus ? interviewStatus.trim() : "";
    }

    if (resumeStatus !== undefined) {
      if (!["Sent", "Not Sent"].includes(resumeStatus)) {
        return res
          .status(400)
          .json({ message: "Invalid Resume Status selection." });
      }
      talentLog.resumeStatus = resumeStatus;
    }

    if (experience !== undefined) {
      if (!["Experienced", "Fresher"].includes(experience)) {
        return res.status(400).json({ message: "Experience is required." });
      }
      talentLog.experience = experience;
    }

    // Handle resume replacement
    if (req.file) {
      if (talentLog.resumeFileName) {
        const oldPath = path.join(
          __dirname,
          "..",
          "uploads",
          "resumes",
          talentLog.resumeFileName,
        );
        fs.unlink(oldPath, (err) => {
          if (err && err.code !== "ENOENT")
            console.error("Failed to delete old resume:", err);
        });
      }
      talentLog.resumeFileName = req.file.filename;
      talentLog.resumeOriginalName = req.file.originalname;
    }

    await talentLog.save();

    await AuditLog.create({
      action: "UPDATE_TALENT_SUBMISSION",
      details: `Talent Corner submission id '${talentLog._id}' was updated by '${req.user.role}'.`,
      performedBy: req.user.id,
    });

    res.status(200).json({
      message: "Talent Corner submission updated successfully.",
      data: talentLog,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download resume
exports.downloadResume = async (req, res) => {
  try {
    const { id } = req.params;
    const talentLog = await TalentCorner.findById(id);
    if (!talentLog || !talentLog.resumeFileName) {
      return res.status(404).json({ message: "Resume not found." });
    }

    if (
      req.user.role !== "superadmin" &&
      talentLog.hrId.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "You are not authorized to view this resume." });
    }

    const filePath = path.join(
      __dirname,
      "..",
      "uploads",
      "resumes",
      talentLog.resumeFileName,
    );
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "Resume file missing on server." });
    }

    res.download(filePath, talentLog.resumeOriginalName || "resume.pdf");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Export Talent Corner submissions as CSV
exports.exportTalent = async (req, res) => {
  try {
    if (req.user.role === "hr") {
      const hrUser = await User.findById(req.user.id);
      if (!hrUser || !hrUser.projects.includes("Talent Corner")) {
        return res.status(403).json({
          message: "You are not assigned to the Talent Corner project.",
        });
      }
    }

    const dateQuery = buildDateFilter(req.query, "createdAt");
    const query = { ...dateQuery };

    if (req.query.hrId || req.query.hr) {
      query.hrId = req.query.hrId || req.query.hr;
    }
    if (req.query.candidateDesignation) {
      query.candidateDesignation = req.query.candidateDesignation;
    } else if (req.query.designation) {
      query.candidateDesignation = req.query.designation;
    }
    if (req.query.search) {
      const escapedSearch = req.query.search.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );
      query.$or = [
        { candidateName: { $regex: escapedSearch, $options: "i" } },
        { candidatePhone: { $regex: escapedSearch, $options: "i" } },
        { candidateLocation: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const submissions = await TalentCorner.find(query)
      .populate("hrId", "name")
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
      "Candidate Location",
      "Candidate Designation",
      "Source",
      "Candidate Phone",
      "Company Name",
      "Interview Status",
      "Resume Status",
      "Resume File",
      "Submitted By",
      "Created At",
    ];

    let csvContent = headers.join(",") + "\n";

    for (const sub of submissions) {
      const row = [
        escapeCSV(sub.candidateName),
        escapeCSV(sub.candidateLocation),
        escapeCSV(sub.candidateDesignation),
        escapeCSV(sub.source),
        escapeCSV(sub.candidatePhone),
        escapeCSV(sub.companyName),
        escapeCSV(sub.interviewStatus),
        escapeCSV(sub.resumeStatus),
        escapeCSV(sub.experience),
        escapeCSV(sub.resumeOriginalName || ""),
        escapeCSV(sub.hrId ? sub.hrId.name : "Unknown"),
        escapeCSV(sub.createdAt.toISOString()),
      ];
      csvContent += row.join(",") + "\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=talent_corner_submissions.csv",
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
