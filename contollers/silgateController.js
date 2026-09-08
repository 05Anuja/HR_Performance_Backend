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

    // const existingCandidate = await Silgate.findOne({
    //   candidatePhone: candidatePhone,
    // });

    // if (existingCandidate) {
    //   return res.status(400).json({
    //     message: "A candidate with this phone number already exists.",
    //   });
    // }

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

    const hrId = req.user.id;

    const query = {
      $or: [
        // Leads originally created by this HR
        // and NOT assigned to someone else
        {
          hrId: hrId,
          $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
        },

        // Leads assigned to this HR
        {
          assignedTo: hrId,
        },
      ],
      ...dateQuery,
    };

    if (req.query.language) {
      query.language = req.query.language;
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

      query.$and = [
        {
          $or: [
            { candidateName: { $regex: escapedSearch, $options: "i" } },
            { candidatePhone: { $regex: escapedSearch, $options: "i" } },
            { candidateLocation: { $regex: escapedSearch, $options: "i" } },
          ],
        },
      ];
    }

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
    console.error("getMySilgateData Error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};

// Get all Silgate submissions (Superadmin only)
exports.getAllSilgateData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const dateQuery = buildDateFilter(req.query, "createdAt");
    const query = { ...dateQuery };

    if (req.query.language) {
      query.language = req.query.language;
    }
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

    const total = await Silgate.countDocuments(query);
    const data = await Silgate.find(query)
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
    } = req.body;

    // --------------------------------------------------
    // 1. Find Silgate submission
    // --------------------------------------------------
    const silgateLog = await Silgate.findById(id);

    if (!silgateLog) {
      return res.status(404).json({
        message: "Silgate submission not found.",
      });
    }

    // --------------------------------------------------
    // 2. Get logged-in user's information
    // --------------------------------------------------
    const userId = req.user?.id?.toString();
    const userRole = req.user?.role?.toLowerCase();

    // Make sure projects is always treated as an array
    const userProjects = Array.isArray(req.user?.projects)
      ? req.user.projects
      : [];

    // --------------------------------------------------
    // 3. Debug logs
    // --------------------------------------------------
    console.log("====================================");
    console.log("Silgate Submission ID:", silgateLog._id);
    console.log("Silgate HRID:", silgateLog.hrId);
    console.log("Logged-in User ID:", userId);
    console.log("User Role:", userRole);
    console.log("User Projects:", userProjects);
    console.log("====================================");

    // --------------------------------------------------
    // 4. Authorization
    // --------------------------------------------------
    const isSuperAdmin = userRole === "superadmin";

    const hasSilgateAccess = userProjects.some(
      (project) => project?.toString().trim().toLowerCase() === "silgate",
    );

    console.log("Is Super Admin:", isSuperAdmin);
    console.log("Has Silgate Access:", hasSilgateAccess);

    /*
      Authorization rule:

      Superadmin
          OR
      HR assigned to Silgate project

      can update ANY Silgate submission.

      silgateLog.hrId is NOT checked here.
    */

    if (!isSuperAdmin && !hasSilgateAccess) {
      return res.status(403).json({
        message:
          "You are not authorized to update Silgate submissions. You must be assigned to the Silgate project.",
      });
    }

    // --------------------------------------------------
    // 5. Candidate Name
    // --------------------------------------------------
    if (candidateName !== undefined) {
      if (typeof candidateName !== "string" || !candidateName.trim()) {
        return res.status(400).json({
          message: "Candidate's Name is required.",
        });
      }

      silgateLog.candidateName = candidateName.trim();
    }

    // --------------------------------------------------
    // 6. Candidate Phone
    // --------------------------------------------------
    if (candidatePhone !== undefined) {
      const phone = candidatePhone.toString().trim();

      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({
          message: "A valid 10-digit Candidate's Phone is required.",
        });
      }

      // const existingSilgate = await Silgate.findOne({
      //   candidatePhone: phone,
      //   _id: { $ne: id },
      // });

      // if (existingSilgate) {
      //   return res.status(400).json({
      //     message: "This Candidate's Phone number already exists in Silgate.",
      //   });
      // }

      silgateLog.candidatePhone = phone;
    }

    // --------------------------------------------------
    // 7. Candidate Location
    // --------------------------------------------------
    if (candidateLocation !== undefined) {
      if (typeof candidateLocation === "string" && candidateLocation.trim()) {
        silgateLog.candidateLocation = candidateLocation.trim();
      } else {
        silgateLog.candidateLocation = "";
      }
    }

    // --------------------------------------------------
    // 8. Language
    // --------------------------------------------------
    if (language !== undefined) {
      if (typeof language !== "string" || !language.trim()) {
        return res.status(400).json({
          message: "Language is required.",
        });
      }

      silgateLog.language = language.trim();
    }

    // --------------------------------------------------
    // 9. Disposition
    // --------------------------------------------------
    if (disposition !== undefined) {
      if (typeof disposition !== "string" || !disposition.trim()) {
        return res.status(400).json({
          message: "Disposition is required.",
        });
      }

      const trimmedDisposition = disposition.trim();

      const dispositionExists = await Disposition.findOne({
        disposition: trimmedDisposition,
        project: "Silgate",
      });

      if (!dispositionExists) {
        return res.status(400).json({
          message:
            "Invalid Disposition selection. The disposition must exist and be assigned to Silgate.",
        });
      }

      silgateLog.disposition = trimmedDisposition;
    }

    // --------------------------------------------------
    // 10. Source
    // --------------------------------------------------
    if (source !== undefined) {
      if (source && typeof source === "string") {
        const trimmedSource = source.trim();

        const sourceExists = await Sources.findOne({
          sourceName: trimmedSource,
          project: "Silgate",
        });

        if (!sourceExists) {
          return res.status(400).json({
            message:
              "Invalid Source selection. The source must exist and be assigned to Silgate.",
          });
        }

        silgateLog.source = trimmedSource;
      } else {
        silgateLog.source = "";
      }
    }

    // --------------------------------------------------
    // 11. Candidate Designation
    // --------------------------------------------------
    if (candidateDesignation !== undefined) {
      if (
        typeof candidateDesignation !== "string" ||
        !candidateDesignation.trim()
      ) {
        return res.status(400).json({
          message: "Candidate's Designation is required.",
        });
      }

      const trimmedDesignation = candidateDesignation.trim();

      const designationExists = await Designation.findOne({
        name: trimmedDesignation,
        project: "Silgate",
      });

      if (!designationExists) {
        return res.status(400).json({
          message:
            "Invalid Candidate's Designation. The designation must exist and be assigned to Silgate.",
        });
      }

      silgateLog.candidateDesignation = trimmedDesignation;
    }

    // --------------------------------------------------
    // 12. Resume Status
    // --------------------------------------------------
    if (resumeStatus !== undefined) {
      if (!["Sent", "Not Sent"].includes(resumeStatus)) {
        return res.status(400).json({
          message: "Invalid Resume Status selection.",
        });
      }

      silgateLog.resumeStatus = resumeStatus;
    }

    // --------------------------------------------------
    // 13. Experience
    // --------------------------------------------------
    if (experience !== undefined) {
      if (!["Experienced", "Fresher"].includes(experience)) {
        return res.status(400).json({
          message: "Experience must be either Experienced or Fresher.",
        });
      }

      silgateLog.experience = experience;
    }

    // --------------------------------------------------
    // 14. Resume Upload
    // --------------------------------------------------
    if (req.file) {
      // Delete old resume
      if (silgateLog.resumeFileName) {
        const oldPath = path.join(
          __dirname,
          "..",
          "uploads",
          "resumes",
          silgateLog.resumeFileName,
        );

        fs.unlink(oldPath, (err) => {
          if (err && err.code !== "ENOENT") {
            console.error("Failed to delete old resume:", err);
          }
        });
      }

      // Save new resume information
      silgateLog.resumeFileName = req.file.filename;
      silgateLog.resumeOriginalName = req.file.originalname;
    }

    // --------------------------------------------------
    // 15. Save
    // --------------------------------------------------
    await silgateLog.save();

    // --------------------------------------------------
    // 16. Audit Log
    // --------------------------------------------------
    await AuditLog.create({
      action: "UPDATE_SILGATE_SUBMISSION",
      details: `Silgate submission id '${silgateLog._id}' was updated by '${req.user.role}'.`,
      performedBy: req.user.id,
    });

    // --------------------------------------------------
    // 17. Success Response
    // --------------------------------------------------
    return res.status(200).json({
      message: "Silgate submission updated successfully.",
      data: silgateLog,
    });
  } catch (error) {
    console.error("Update Silgate Error:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
};

// Download resume
exports.downloadResume = async (req, res) => {
  try {
    const { id } = req.params;
    const silgateLog = await Silgate.findById(id);
    if (!silgateLog || !silgateLog.resumeFileName) {
      return res.status(404).json({ message: "Resume not found." });
    }

    if (
      req.user.role !== "superadmin" &&
      silgateLog.hrId.toString() !== req.user.id
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
    const query = { ...dateQuery };

    if (req.query.language) {
      query.language = req.query.language;
    }
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

    const submissions = await Silgate.find(query)
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
      "Candidate Phone",
      "Candidate Location",
      "Language",
      "Disposition",
      "Source",
      "Candidate Designation",
      "Resume Status",
      "Resume File",
      "Submitted By",
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

exports.assignSilgate = async (req, res) => {
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
    // FIND LEADS
    // =====================================================
    //
    // IMPORTANT:
    //
    // We DO NOT check:
    //
    //     hrId: currentUserId
    //
    // because hrId is the ORIGINAL CREATOR.
    //
    // Instead:
    //
    // 1. If assignedTo is null -> original owner currently
    //    controls the lead.
    //
    // 2. If assignedTo == currentUserId -> current HR
    //    currently controls the lead.
    //
    // =====================================================

    let ownershipCondition;

    if (req.user.role === "superadmin") {
      // Superadmin can assign any lead.
      ownershipCondition = {};
    } else {
      ownershipCondition = {
        $or: [
          {
            // Lead has never been assigned
            hrId: currentUserId,
            $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
          },

          {
            // Lead is currently assigned to logged-in HR
            assignedTo: currentUserId,
          },
        ],
      };
    }

    const leads = await Silgate.find({
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

    const updateResult = await Silgate.updateMany(
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
      action: "UPDATE_SILGATE_SUBMISSION",

      details:
        `${updateResult.modifiedCount} Silgate lead(s) ` +
        `assigned from '${currentUserId}' to ` +
        `'${assignedHR._id}' by '${req.user.role}'.`,

      performedBy: currentUserId,
    });

    // =====================================================
    // FETCH UPDATED LEADS
    // =====================================================

    const updatedLeads = await Silgate.find({
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
        `${updateResult.modifiedCount} Silgate lead(s) ` +
        `assigned successfully.`,

      assignedCount: updateResult.modifiedCount,

      data: updatedLeads,
    });
  } catch (error) {
    console.error("Assign Silgate Error:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
};
