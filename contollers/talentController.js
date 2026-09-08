const TalentCorner = require("../models/TalentCorner");
const User = require("../models/User");
const mongoose = require("mongoose");
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

    // const existingTalentCornerPhone = await TalentCorner.findOne({
    //   candidatePhone,
    // });

    // if (existingTalentCornerPhone) {
    //   return res.status(400).json({
    //     message:
    //       "This Candidate's Phone number already exists in Talent Corner.",
    //   });
    // }

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
    // =====================================================
    // PAGINATION
    // =====================================================

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // =====================================================
    // DATE FILTER
    // =====================================================

    const dateQuery = buildDateFilter(req.query, "createdAt");

    // =====================================================
    // CURRENT LOGGED-IN HR
    // =====================================================

    const hrId = req.user.id;

    // =====================================================
    // OWNERSHIP CONDITION
    // =====================================================
    //
    // 1. Original HR's leads which are NOT assigned
    //    to anyone.
    //
    // 2. Leads currently assigned to this HR.
    //
    // Example:
    //
    // HR1 creates lead:
    // hrId = HR1
    // assignedTo = null
    //
    // HR1 assigns to HR2:
    // hrId = HR1
    // assignedTo = HR2
    //
    // Now HR1 will NOT see it.
    // HR2 WILL see it.
    //
    // =====================================================

    const query = {
      $or: [
        {
          hrId: hrId,
          $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
        },

        {
          assignedTo: hrId,
        },
      ],
      ...dateQuery,
    };

    // =====================================================
    // DESIGNATION FILTER
    // =====================================================

    if (req.query.candidateDesignation) {
      query.candidateDesignation = req.query.candidateDesignation;
    } else if (req.query.designation) {
      query.candidateDesignation = req.query.designation;
    }

    // =====================================================
    // SEARCH
    // =====================================================

    if (req.query.search) {
      const escapedSearch = req.query.search.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );

      query.$and = [
        {
          $or: [
            {
              candidateName: {
                $regex: escapedSearch,
                $options: "i",
              },
            },
            {
              candidatePhone: {
                $regex: escapedSearch,
                $options: "i",
              },
            },
            {
              candidateLocation: {
                $regex: escapedSearch,
                $options: "i",
              },
            },
          ],
        },
      ];
    }

    // =====================================================
    // TOTAL COUNT
    // =====================================================

    const total = await TalentCorner.countDocuments(query);

    // =====================================================
    // FETCH DATA
    // =====================================================

    const data = await TalentCorner.find(query)
      .populate("hrId", "name")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      data,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalSubmissions: total,
    });
  } catch (error) {
    console.error("getMyTalentData Error:", error);

    return res.status(500).json({
      message: error.message,
    });
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

    // if (
    //   req.user.role !== "superadmin" &&
    //   talentLog.hrId.toString() !== req.user.id
    // ) {
    //   return res
    //     .status(403)
    //     .json({ message: "You are not authorized to update this submission." });
    // }

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
      const phone = candidatePhone.toString().trim();
      if (!/^\d{10}$/.test(candidatePhone)) {
        return res
          .status(400)
          .json({ message: "A valid 10-digit Candidate's Phone is required." });
      }

      // const existingTalentCorner = await TalentCorner.findOne({
      //   candidatePhone: phone,
      //   _id: { $ne: id },
      // });

      // if (existingTalentCorner) {
      //   return res.status(400).json({
      //     message:
      //       "This Candidate's Phone number already exists in Talent Corner.",
      //   });
      // }
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

exports.assignTalentCorner = async (req, res) => {
  try {
    const { assignedTo, leadIds } = req.body;

    // =====================================================
    // CURRENT LOGGED-IN USER
    // =====================================================

    const currentUserId = req.user.id;

    // =====================================================
    // VALIDATE assignedTo
    // =====================================================

    if (!assignedTo) {
      return res.status(400).json({
        message: "assignedTo is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({
        message: "Invalid assignedTo.",
      });
    }

    // =====================================================
    // VALIDATE leadIds
    // =====================================================

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        message: "At least one leadId is required.",
      });
    }

    const invalidLeadIds = leadIds.filter(
      (leadId) => !mongoose.Types.ObjectId.isValid(leadId),
    );

    if (invalidLeadIds.length > 0) {
      return res.status(400).json({
        message: "One or more lead IDs are invalid.",
        invalidLeadIds,
      });
    }

    // =====================================================
    // CHECK TARGET HR
    // =====================================================

    const assignedHR = await User.findOne({
      _id: assignedTo,
      role: "hr",
    }).select("_id name email role");

    if (!assignedHR) {
      return res.status(404).json({
        message: "Assigned user was not found or is not an HR.",
      });
    }

    // =====================================================
    // PREVENT ASSIGNING TO SAME HR
    // =====================================================

    if (currentUserId.toString() === assignedTo.toString()) {
      return res.status(400).json({
        message: "Cannot assign leads to yourself.",
      });
    }

    // =====================================================
    // FIND ACCESSIBLE LEADS
    // =====================================================
    //
    // IMPORTANT:
    //
    // hrId = ORIGINAL CREATOR
    //
    // assignedTo = CURRENT HR
    //
    // Therefore we DO NOT simply check:
    //
    //     hrId: currentUserId
    //
    // because after reassignment, hrId still contains
    // the original creator.
    //
    // =====================================================

    let ownershipCondition;

    if (req.user.role === "superadmin") {
      // Superadmin can assign any Talent Corner lead.
      ownershipCondition = {};
    } else {
      ownershipCondition = {
        $or: [
          {
            // Lead was created by this HR and has
            // never been assigned to another HR.
            hrId: currentUserId,
            $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
          },

          {
            // Lead is currently assigned to this HR.
            assignedTo: currentUserId,
          },
        ],
      };
    }

    // =====================================================
    // FETCH ONLY ACCESSIBLE LEADS
    // =====================================================

    const leads = await TalentCorner.find({
      _id: { $in: leadIds },
      ...ownershipCondition,
    }).select("_id hrId assignedTo candidateName");

    // =====================================================
    // NO ACCESSIBLE LEADS
    // =====================================================

    if (leads.length === 0) {
      return res.status(403).json({
        message: "You are not authorized to assign the selected leads.",
      });
    }

    // =====================================================
    // GET VALID LEAD IDS
    // =====================================================

    const validLeadIds = leads.map((lead) => lead._id);

    // =====================================================
    // ASSIGN LEADS
    // =====================================================

    const updateResult = await TalentCorner.updateMany(
      {
        _id: { $in: validLeadIds },
      },
      {
        $set: {
          assignedTo: assignedHR._id,
        },
      },
    );

    // =====================================================
    // AUDIT LOG
    // =====================================================

    await AuditLog.create({
      action: "UPDATE_TALENT_SUBMISSION",

      details:
        `${updateResult.modifiedCount} Talent Corner lead(s) ` +
        `assigned from '${currentUserId}' to ` +
        `'${assignedHR._id}' by '${req.user.role}'.`,

      performedBy: currentUserId,
    });

    // =====================================================
    // FETCH UPDATED LEADS
    // =====================================================

    const updatedLeads = await TalentCorner.find({
      _id: { $in: validLeadIds },
    })
      .populate("hrId", "name")
      .populate("assignedTo", "name");

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      message:
        `${updateResult.modifiedCount} Talent Corner lead(s) ` +
        `assigned successfully.`,

      assignedCount: updateResult.modifiedCount,

      data: updatedLeads,
    });
  } catch (error) {
    console.error("Assign Talent Corner Error:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
};
