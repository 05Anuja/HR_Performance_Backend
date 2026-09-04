const Silgate = require("../models/Silgate");
const TalentCorner = require("../models/TalentCorner");
const User = require("../models/User");
const mongoose = require("mongoose");
const InterviewStatus = require("../models/InterviewStatus");
const Disposition = require("../models/Disposition");

const getRecruitmentReportStats = async (
  hrId,
  projectId,
  startDate,
  endDate,
) => {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) {
      dateFilter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.createdAt.$lte = end;
    }
  } else {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    dateFilter.createdAt = {
      $gte: startOfToday,
      $lte: endOfToday,
    };
  }

  const allHrUsers = await User.find({ role: "hr" }).select(
    "name status projects",
  );
  const hrNameMap = {};
  const hrSharesMap = {};
  const allHrIds = [];

  allHrUsers.forEach((u) => {
    const idStr = u._id.toString();
    hrNameMap[idStr] = u.name;
    allHrIds.push(u._id);

    // Check filters for pre-populating active HRs with 0 submissions
    const matchesHrFilter =
      !hrId || hrId === "all" || hrId.toString() === idStr;
    let matchesProjectFilter = true;
    if (projectId === "silgate") {
      matchesProjectFilter = u.projects && u.projects.includes("Silgate");
    } else if (projectId === "talent_corner") {
      matchesProjectFilter = u.projects && u.projects.includes("Talent Corner");
    }

    if (u.status !== "inactive" && matchesHrFilter && matchesProjectFilter) {
      hrSharesMap[u.name] = 0;
    }
  });

  const silgateQuery = { ...dateFilter };
  const talentQuery = { ...dateFilter };

  if (hrId && hrId !== "all" && mongoose.isValidObjectId(hrId)) {
    const isHrUser = allHrUsers.some((u) => u._id.toString() === hrId);
    if (isHrUser) {
      const hrObjectId = new mongoose.Types.ObjectId(hrId);
      silgateQuery.hrId = hrObjectId;
      talentQuery.hrId = hrObjectId;
    } else {
      // If it's a superadmin or non-HR, force the query to return empty
      const emptyObjectId = new mongoose.Types.ObjectId();
      silgateQuery.hrId = emptyObjectId;
      talentQuery.hrId = emptyObjectId;
    }
  } else {
    silgateQuery.hrId = { $in: allHrIds };
    talentQuery.hrId = { $in: allHrIds };
  }

  let includeSilgate = true;
  let includeTalent = true;

  if (projectId === "silgate") {
    includeTalent = false;
  } else if (projectId === "talent_corner") {
    includeSilgate = false;
  }

  let totalProfilesShared = 0;
  const uniqueHRIds = new Set();
  const uniqueDesignations = new Set();
  let resumeSent = 0;
  let resumeNotSent = 0;
  let silgateInterested = 0;
  let silgateNotInterested = 0;

  const designationSharesMap = {};
  const sourceSharesMap = {};

  const normalizeSource = (src) => {
    if (!src) return "Not Selected";
    const s = src.trim().toLowerCase();
    if (s === "workindia" || s === "work india") return "Work India";
    if (s === "naukri") return "Naukri";
    if (s === "indeed") return "Indeed";
    if (s === "linkedin") return "Linkedin";
    if (s === "reference") return "Reference";
    return src.trim().charAt(0).toUpperCase() + src.trim().slice(1);
  };

  const MASTER_STANDARD_DESIGNATIONS = [
    "BDE",
    "Digital Marketing",
    "EA",
    "HR",
    "Pricing Executive",
    "Social Media Manager",
    "Travel Consultat",
    "Travel Consultant",
    "Accounts & Finance Manager",
    "AEM",
    "Backend Data Entry Exe",
    "Clinical Operations Manager",
    "Content Creator",
    "Customer Support Exe",
    "ECommerce Exe",
    "IT Sales",
    "RM",
    "Sales Coordinator",
    "Stock Inventory",
    "Telecaller",
    "QA",
    "TL",
  ];

  const normalizeDesignation = (des) => {
    if (!des) return "";
    const clean = des.trim().replace(/\s+/g, " ");
    if (!clean) return "";

    const matchedStd = MASTER_STANDARD_DESIGNATIONS.find(
      (std) => std.toLowerCase() === clean.toLowerCase(),
    );
    if (matchedStd) {
      return matchedStd;
    }

    return clean
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (includeSilgate) {
    const silgateDocs = await Silgate.find(silgateQuery);
    totalProfilesShared += silgateDocs.length;
    silgateDocs.forEach((doc) => {
      const hrIdStr = doc.hrId.toString();
      uniqueHRIds.add(hrIdStr);

      const hrName = hrNameMap[hrIdStr] || "System";
      hrSharesMap[hrName] = (hrSharesMap[hrName] || 0) + 1;

      const rawDes = doc.candidateDesignation
        ? doc.candidateDesignation.trim()
        : "";
      const des = normalizeDesignation(rawDes);
      if (des) {
        uniqueDesignations.add(des);
        designationSharesMap[des] = (designationSharesMap[des] || 0) + 1;
      }

      const src = normalizeSource(doc.source);
      sourceSharesMap[src] = (sourceSharesMap[src] || 0) + 1;

      if (doc.disposition === "Interested Lineup") {
        silgateInterested++;
      } else {
        silgateNotInterested++;
      }
    });
  }

  if (includeTalent) {
    const talentDocs = await TalentCorner.find(talentQuery);
    totalProfilesShared += talentDocs.length;
    talentDocs.forEach((doc) => {
      const hrIdStr = doc.hrId.toString();
      uniqueHRIds.add(hrIdStr);

      const hrName = hrNameMap[hrIdStr] || "System";
      hrSharesMap[hrName] = (hrSharesMap[hrName] || 0) + 1;

      const rawDes = doc.candidateDesignation
        ? doc.candidateDesignation.trim()
        : "";
      const des = normalizeDesignation(rawDes);
      if (des) {
        uniqueDesignations.add(des);
        designationSharesMap[des] = (designationSharesMap[des] || 0) + 1;
      }

      const src = normalizeSource(doc.source);
      sourceSharesMap[src] = (sourceSharesMap[src] || 0) + 1;

      if (doc.resumeStatus === "Sent") {
        resumeSent++;
      } else {
        resumeNotSent++;
      }
    });
  }

  const hrWiseSummary = Object.keys(hrSharesMap)
    .map((name) => ({
      hrName: name,
      count: hrSharesMap[name],
    }))
    .sort((a, b) => b.count - a.count);

  const designationWiseSummary = Object.keys(designationSharesMap)
    .map((des) => ({
      designation: des,
      count: designationSharesMap[des],
    }))
    .sort((a, b) => b.count - a.count);

  const sourceWiseSummary = Object.keys(sourceSharesMap)
    .map((src) => {
      const count = sourceSharesMap[src];
      const percentage =
        totalProfilesShared > 0
          ? Math.round((count / totalProfilesShared) * 100)
          : 0;
      return {
        source: src,
        count,
        percentage,
      };
    })
    .sort((a, b) => b.count - a.count);

  let totalHRsCount = 0;
  if (hrId && hrId !== "all" && mongoose.isValidObjectId(hrId)) {
    const exists = await User.countDocuments({
      _id: hrId,
      role: "hr",
      status: { $ne: "inactive" },
    });
    totalHRsCount = exists;
  } else {
    const query = { role: "hr", status: { $ne: "inactive" } };
    if (projectId === "silgate") {
      query.projects = "Silgate";
    } else if (projectId === "talent_corner") {
      query.projects = "Talent Corner";
    }
    totalHRsCount = await User.countDocuments(query);
  }

  return {
    totalProfilesShared,
    totalHRs: totalHRsCount,
    totalDesignations: uniqueDesignations.size,
    resumeSent,
    resumeNotSent,
    silgateInterested,
    silgateNotInterested,
    hrWiseSummary,
    designationWiseSummary,
    sourceWiseSummary,
  };
};

exports.getDashboardStats = async (req, res) => {
  try {
    const isSuperadmin = req.user.role === "superadmin";
    const { hrId, projectId, startDate, endDate } = req.query;

    const dateMatch = {};
    if (startDate || endDate) {
      dateMatch.createdAt = {};
      if (startDate) {
        dateMatch.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateMatch.createdAt.$lte = end;
      }
    } else {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      dateMatch.createdAt = {
        $gte: startOfToday,
        $lte: endOfToday,
      };
    }

    // Get active HRs
    const activeHRs = await User.find({
      role: "hr",
      status: { $ne: "inactive" },
    }).select("_id");
    const activeHRIds = activeHRs.map((hr) => hr._id);

    // --- 1. GLOBAL COUNTS FOR SUPERADMIN (ALWAYS RETURNED IF ROLE IS SUPERADMIN) ---
    let globalStats = null;
    let filters = null;
    if (isSuperadmin) {
      const totalProjects = 2; // Static: Silgate & Talent Corner
      const totalSilgate = await Silgate.countDocuments(dateMatch);
      const totalTalent = await TalentCorner.countDocuments(dateMatch);
      const totalSubmissions = totalSilgate + totalTalent;
      const totalHRs = activeHRIds.length;
      const totalForms = 2; // Static: Silgate & Talent Corner Form layouts

      globalStats = {
        totalProjects,
        totalSubmissions,
        totalHRs,
        totalForms,
      };

      // Get filter dropdown datasets
      const hrsDropdown = await User.find({
        role: "hr",
        status: { $ne: "inactive" },
      }).select("name ecn");
      const projectsDropdown = [
        { _id: "silgate", name: "Silgate" },
        { _id: "talent_corner", name: "Talent Corner" },
      ];
      filters = {
        hrs: hrsDropdown,
        projects: projectsDropdown,
      };
    }

    // --- CASE E: HR USER SELF-SERVICE VIEW ---
    if (!isSuperadmin) {
      const selfId = req.user.id;
      const targetUser = await User.findById(selfId);

      // HR stats
      const hrProjectsCount = targetUser.projects
        ? targetUser.projects.length
        : 0;
      const silgateCount = await Silgate.countDocuments({
        hrId: selfId,
        ...dateMatch,
      });
      const talentCount = await TalentCorner.countDocuments({
        hrId: selfId,
        ...dateMatch,
      });
      const hrSubmissionsCount = silgateCount + talentCount;

      const reportStats = await getRecruitmentReportStats(
        selfId,
        "null",
        startDate,
        endDate,
      );

      return res.status(200).json({
        type: "hr_self_service",
        stats: {
          totalProjects: hrProjectsCount,
          totalSubmissions: hrSubmissionsCount,
        },
        reportStats,
      });
    }

    // --- IF SUPERADMIN: CHECK ADVANCED FILTERS ---
    const filterHr = hrId && hrId !== "all";
    const filterProject = projectId && projectId !== "null";

    // --- CASE D: FILTERED BY BOTH HR AND PROJECT ---
    if (filterHr && filterProject) {
      const targetUser = await User.findOne({
        _id: hrId,
        role: "hr",
        status: { $ne: "inactive" },
      }).select("name ecn role status projects");
      if (!targetUser) {
        return res.status(404).json({ message: "Active HR User not found." });
      }

      let totalSubmissions = 0;
      let targetProject = null;

      if (projectId === "silgate") {
        targetProject = {
          _id: "silgate",
          name: "Silgate",
          description: "Silgate calling campaign form",
        };
        totalSubmissions = await Silgate.countDocuments({ hrId, ...dateMatch });
      } else if (projectId === "talent_corner") {
        targetProject = {
          _id: "talent_corner",
          name: "Talent Corner",
          description: "Talent Corner CV submission form",
        };
        totalSubmissions = await TalentCorner.countDocuments({
          hrId,
          ...dateMatch,
        });
      } else {
        return res.status(400).json({ message: "Invalid project filter." });
      }

      const assignedHRsCount = await User.countDocuments({
        role: "hr",
        status: { $ne: "inactive" },
        projects: targetProject.name,
      });

      const reportStats = await getRecruitmentReportStats(
        hrId,
        projectId,
        startDate,
        endDate,
      );

      return res.status(200).json({
        type: "hr_and_project_details",
        globalStats,
        filters,
        hr: targetUser,
        project: targetProject,
        stats: {
          totalSubmissions,
          totalHRsAssigned: assignedHRsCount,
        },
        reportStats,
      });
    }

    // --- CASE B: FILTERED BY HR ONLY ---
    if (filterHr && !filterProject) {
      const targetUser = await User.findOne({
        _id: hrId,
        role: "hr",
        status: { $ne: "inactive" },
      }).select("name ecn role status projects");
      if (!targetUser) {
        return res.status(404).json({ message: "Active HR User not found." });
      }

      const hrProjectsCount = targetUser.projects
        ? targetUser.projects.length
        : 0;
      const silgateCount = await Silgate.countDocuments({ hrId, ...dateMatch });
      const talentCount = await TalentCorner.countDocuments({
        hrId,
        ...dateMatch,
      });
      const hrSubmissionsCount = silgateCount + talentCount;

      const reportStats = await getRecruitmentReportStats(
        hrId,
        "null",
        startDate,
        endDate,
      );

      return res.status(200).json({
        type: "hr_details",
        globalStats,
        filters,
        hr: targetUser,
        stats: {
          totalProjects: hrProjectsCount,
          totalSubmissions: hrSubmissionsCount,
        },
        reportStats,
      });
    }

    // --- CASE C: FILTERED BY PROJECT ONLY ---
    if (!filterHr && filterProject) {
      let targetProject = null;
      let projectSubmissionsCount = 0;

      if (projectId === "silgate") {
        targetProject = {
          _id: "silgate",
          name: "Silgate",
          description: "Silgate calling campaign form",
        };
        projectSubmissionsCount = await Silgate.countDocuments(dateMatch);
      } else if (projectId === "talent_corner") {
        targetProject = {
          _id: "talent_corner",
          name: "Talent Corner",
          description: "Talent Corner CV submission form",
        };
        projectSubmissionsCount = await TalentCorner.countDocuments(dateMatch);
      } else {
        return res.status(400).json({ message: "Invalid project filter." });
      }

      // A list of only HRs assigned to this project
      const allHRs = await User.find({
        role: "hr",
        status: { $ne: "inactive" },
        projects: targetProject.name,
      }).select("name ecn status");
      const assignedHRs = [];
      for (const hr of allHRs) {
        const count =
          projectId === "silgate"
            ? await Silgate.countDocuments({ hrId: hr._id, ...dateMatch })
            : await TalentCorner.countDocuments({ hrId: hr._id, ...dateMatch });

        assignedHRs.push({
          _id: hr._id,
          name: hr.name,
          ecn: hr.ecn,
          status: hr.status,
          submissionsCount: count,
        });
      }

      const reportStats = await getRecruitmentReportStats(
        "all",
        projectId,
        startDate,
        endDate,
      );

      return res.status(200).json({
        type: "project_details",
        globalStats,
        filters,
        project: targetProject,
        stats: {
          totalSubmissions: projectSubmissionsCount,
          totalHRsAssigned: assignedHRs.length,
        },
        assignedHRs,
        reportStats,
      });
    }

    // --- CASE A: DEFAULT VIEW (SUPERADMIN OVERVIEW) ---
    // Retrieve HR overview records
    const allHRs = await User.find({
      role: "hr",
      status: { $ne: "inactive" },
    }).select("name ecn status projects");
    const hrs = [];
    for (const hr of allHRs) {
      const silgateCount = await Silgate.countDocuments({
        hrId: hr._id,
        ...dateMatch,
      });
      const talentCount = await TalentCorner.countDocuments({
        hrId: hr._id,
        ...dateMatch,
      });
      hrs.push({
        _id: hr._id,
        name: hr.name,
        ecn: hr.ecn,
        status: hr.status,
        projects: hr.projects || [],
        totalSubmissions: silgateCount + talentCount,
      });
    }

    const reportStats = await getRecruitmentReportStats(
      "all",
      "null",
      startDate,
      endDate,
    );

    return res.status(200).json({
      type: "default_overview",
      stats: globalStats,
      filters,
      hrs,
      reportStats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDispositionColumns = async () => {
  const dispositions = await Disposition.find({ project: "Silgate" })
    .sort({ createdAt: 1 })
    .select("disposition");
  return dispositions.map((d) => d.disposition);
};

exports.getDispositionBreakdown = async (req, res) => {
  try {
    const DISPOSITION_COLUMNS = await getDispositionColumns();
    const isSuperadmin = req.user.role === "superadmin";
    const { hrId, startDate, endDate, page, limit } = req.query;

    // --- Date filter ---
    const dateMatch = {};
    if (startDate || endDate) {
      dateMatch.createdAt = {};
      if (startDate) dateMatch.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateMatch.createdAt.$lte = end;
      }
    } else {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      dateMatch.createdAt = { $gte: startOfToday, $lte: endOfToday };
    }

    // --- HR filter (same pattern as your other controllers) ---
    let activeHRs = [];
    const queryMatch = { ...dateMatch };

    if (isSuperadmin) {
      activeHRs = await User.find({
        role: "hr",
        status: { $ne: "inactive" },
      }).select("name");
      if (hrId && hrId !== "all" && mongoose.isValidObjectId(hrId)) {
        queryMatch.hrId = new mongoose.Types.ObjectId(hrId);
        activeHRs = activeHRs.filter((hr) => hr._id.toString() === hrId);
      } else {
        queryMatch.hrId = { $in: activeHRs.map((hr) => hr._id) };
      }
    } else {
      const selfId = req.user.id;
      const selfUser = await User.findById(selfId).select("name");
      if (selfUser) activeHRs = [selfUser];
      queryMatch.hrId = new mongoose.Types.ObjectId(selfId);
    }

    // --- Build $group stage dynamically from DISPOSITION_COLUMNS ---
    const groupStage = {
      _id: "$hrId",
      total: { $sum: 1 },
    };
    DISPOSITION_COLUMNS.forEach((disp) => {
      groupStage[disp] = {
        $sum: { $cond: [{ $eq: ["$disposition", disp] }, 1, 0] },
      };
    });

    const breakdown = await Silgate.aggregate([
      { $match: queryMatch },
      { $group: groupStage },
    ]);

    const breakdownMap = {};
    breakdown.forEach((item) => {
      if (item._id) {
        breakdownMap[item._id.toString()] = item;
      }
    });

    // --- Empty stats template so every HR row has all columns, even with 0 activity ---
    const emptyStats = { total: 0 };
    DISPOSITION_COLUMNS.forEach((disp) => {
      emptyStats[disp] = 0;
    });

    const allData = activeHRs.map((hr) => {
      const hrIdStr = hr._id.toString();
      const stats = breakdownMap[hrIdStr] || emptyStats;
      const row = {
        hrId: hrIdStr,
        hrName: hr.name,
        total: stats.total,
      };
      DISPOSITION_COLUMNS.forEach((disp) => {
        row[disp] = stats[disp] || 0;
      });
      return row;
    });

    // --- Grand total across ALL HRs (not just the current page) ---
    const grandTotal = { total: 0 };
    DISPOSITION_COLUMNS.forEach((disp) => {
      grandTotal[disp] = 0;
    });

    allData.forEach((item) => {
      grandTotal.total += item.total;
      DISPOSITION_COLUMNS.forEach((disp) => {
        grandTotal[disp] += item[disp];
      });
    });

    // --- Paginate the rows ---
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const totalCount = allData.length;
    const skip = (pageNum - 1) * limitNum;
    const data = allData.slice(skip, skip + limitNum);

    return res.status(200).json({
      success: true,
      columns: ["hrId", "hrName", "total", ...DISPOSITION_COLUMNS],
      data,
      grandTotal,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalSubmissions: totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getInterviewStatusColumns = async () => {
  const statuses = await InterviewStatus.find({ project: "Talent Corner" })
    .sort({ createdAt: 1 })
    .select("interviewStatus");
  return statuses.map((s) => s.interviewStatus);
};

exports.getCompanyDesignationStatusReport = async (req, res) => {
  try {
    const INTERVIEW_STATUS_COLUMNS = await getInterviewStatusColumns();
    const isSuperadmin = req.user.role === "superadmin";
    const {
      hrId,
      company,
      designation,
      startDate,
      endDate,
      status,
      page,
      limit,
    } = req.query;

    // --- Date filter ---
    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    } else {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      match.createdAt = { $gte: start, $lte: end };
    }

    // --- HR filter ---
    if (!isSuperadmin) {
      match.hrId = new mongoose.Types.ObjectId(req.user.id);
    } else if (hrId && hrId !== "all" && mongoose.isValidObjectId(hrId)) {
      match.hrId = new mongoose.Types.ObjectId(hrId);
    }

    // --- Company filter ---
    if (company && company !== "all") {
      match.companyName = company;
    }

    // --- Designation filter ---
    if (designation && designation !== "all") {
      match.candidateDesignation = designation;
    }

    // --- Status filter (only show rows matching a specific status, still tabulate all columns) ---
    // Applied after fetch since it filters candidates, not rows.

    const docs = await TalentCorner.find(match).select(
      "companyName candidateDesignation interviewStatus resumeStatus",
    );

    const rowsMap = {}; // key: `${company}||${designation}`

    for (const doc of docs) {
      const companyName = doc.companyName || "Unassigned";
      const desig = doc.candidateDesignation || "Unassigned";
      const rawStatus = doc.interviewStatus || "Resume Shared"; // default bucket if unset
      // const rawStatus = doc.interviewStatus; // no more "Resume Shared" fallback bucket

      // Optional status filter — skip candidates not matching, if provided
      // if (status && status !== "all" && rawStatus !== status) continue;
      // Optional status filter — skip candidates not matching, if provided
      if (
        status &&
        status !== "all" &&
        (rawStatus || "Resume Shared") !== status
      )
        continue;

      const key = `${companyName}||${desig}`;
      if (!rowsMap[key]) {
        rowsMap[key] = {
          company: companyName,
          designation: desig,
          resumeStatus: 0, // count of candidates whose resumeStatus === "Sent"
        };
        INTERVIEW_STATUS_COLUMNS.forEach((col) => {
          rowsMap[key][col] = 0;
        });
      }

      // if (INTERVIEW_STATUS_COLUMNS.includes(rawStatus)) {
      //   rowsMap[key][rawStatus] += 1;
      // }

      // Count actual resume-sent status from the real DB field
      if (doc.resumeStatus === "Sent") {
        rowsMap[key].resumeStatus += 1;
      }

      if (rawStatus && INTERVIEW_STATUS_COLUMNS.includes(rawStatus)) {
        rowsMap[key][rawStatus] += 1;
      }
      // else: unrecognized status value — silently ignored from stage columns,
      // but still counted in resumeShared. Consider logging these for cleanup.
    }

    // const data = Object.values(rowsMap).sort((a, b) => b.resumeShared - a.resumeShared);

    // return res.status(200).json({
    //   success: true,
    //   columns: ["company", "designation", ...INTERVIEW_STATUS_COLUMNS],
    //   data
    // });
    const allRows = Object.values(rowsMap).sort((a, b) =>
      a.company.localeCompare(b.company),
    );

    // --- Paginate the already-grouped rows ---
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const totalCount = allRows.length;
    const skip = (pageNum - 1) * limitNum;
    const data = allRows.slice(skip, skip + limitNum);

    return res.status(200).json({
      success: true,
      columns: [
        "company",
        "designation",
        "resumeStatus",
        ...INTERVIEW_STATUS_COLUMNS,
      ],
      data,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalSubmissions: totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const formatDate = (date) => {
  if (!date) return "—";
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const d = new Date(date);
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
};

exports.getCandidateDetailsReport = async (req, res) => {
  try {
    const INTERVIEW_STATUS_COLUMNS = await getInterviewStatusColumns();
    const isSuperadmin = req.user.role === "superadmin";
    const {
      hrId,
      company,
      designation,
      startDate,
      endDate,
      status,
      page,
      limit,
    } = req.query;

    // --- Date filter ---
    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    } else {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      match.createdAt = { $gte: start, $lte: end };
    }
    // NOTE: unlike your other reports, this one does NOT default to "today only"
    // when no dates are given — a candidate list usually wants to show everything
    // by default, and let the user narrow it down with the date filter if they want.
    // Remove this comment block and add an else-default here if you want "today only" instead.

    // --- HR filter: non-superadmins only ever see their own submissions ---
    if (!isSuperadmin) {
      match.hrId = new mongoose.Types.ObjectId(req.user.id);
    } else if (hrId && hrId !== "all" && mongoose.isValidObjectId(hrId)) {
      match.hrId = new mongoose.Types.ObjectId(hrId);
    }

    // --- Company filter ---
    if (company && company !== "all") {
      match.companyName = company;
    }

    // --- Designation filter ---
    if (designation && designation !== "all") {
      match.candidateDesignation = designation;
    }

    // --- Status filter ---
    if (status && status !== "all") {
      match.interviewStatus = status;
    }

    // --- Pagination (candidate lists can get long — default 50 per page) ---
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    // .populate("hrId", "name") replaces the hrId ObjectId with the actual HR's
    // name, pulled from the User collection — like a JOIN in SQL terms.
    const [candidates, totalCount] = await Promise.all([
      TalentCorner.find(match)
        .populate("hrId", "name")
        .select(
          "candidateName hrId companyName candidateDesignation interviewStatus resumeStatus createdAt",
        )
        .sort({ createdAt: -1 }) // newest first
        .skip(skip)
        .limit(limitNum),
      TalentCorner.countDocuments(match),
    ]);

    // Reshape each document into exactly the fields your table needs
    const data = candidates.map((doc) => ({
      candidateName: doc.candidateName || "—",
      hrName: doc.hrId?.name || "Unknown", // "?." safely handles a deleted/missing HR
      company: doc.companyName || "Unassigned",
      designation: doc.candidateDesignation || "—",
      resumeSharedDate:
        doc.resumeStatus === "Sent" ? formatDate(doc.createdAt) : "Not Sent",
      currentStatus: doc.interviewStatus || "Resume Shared",
    }));

    return res.status(200).json({
      success: true,
      data,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalSubmissions: totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHrCompanyStatusReport = async (req, res) => {
  try {
    const INTERVIEW_STATUS_COLUMNS = await getInterviewStatusColumns();
    const isSuperadmin = req.user.role === "superadmin";
    const { hrId, company, startDate, endDate, status, page, limit } =
      req.query;

    // --- Date filter ---
    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    } else {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      match.createdAt = { $gte: start, $lte: end };
    }
    // No default "today only" filter here either — same reasoning as candidate-details report.
    // Add an else-block with startOfToday/endOfToday if you want that behavior back.

    // --- HR filter ---
    if (!isSuperadmin) {
      match.hrId = new mongoose.Types.ObjectId(req.user.id);
    } else if (hrId && hrId !== "all" && mongoose.isValidObjectId(hrId)) {
      match.hrId = new mongoose.Types.ObjectId(hrId);
    }

    // --- Company filter ---
    if (company && company !== "all") {
      match.companyName = company;
    }

    // --- Fetch matching candidate docs, only the fields we need ---
    const docs = await TalentCorner.find(match).select(
      "hrId companyName interviewStatus resumeStatus",
    );

    // --- Build a hrId -> hrName lookup map (avoids one query per document) ---
    const hrIds = [
      ...new Set(docs.map((d) => d.hrId?.toString()).filter(Boolean)),
    ];
    const hrUsers = await User.find({ _id: { $in: hrIds } }).select("name");
    const hrNameMap = {};
    hrUsers.forEach((u) => {
      hrNameMap[u._id.toString()] = u.name;
    });

    const rowsMap = {}; // key: `${hrIdStr}||${companyName}`

    for (const doc of docs) {
      const hrIdStr = doc.hrId ? doc.hrId.toString() : "unknown";
      const hrName = hrNameMap[hrIdStr] || "Unknown";
      const companyName = doc.companyName || "Unassigned";
      // const rawStatus = doc.interviewStatus || "Resume Shared";
      const rawStatus = doc.interviewStatus; // no more "Resume Shared" fallback bucket

      // Optional status filter — skip candidates not matching, if provided
      if (
        status &&
        status !== "all" &&
        (rawStatus || "Resume Shared") !== status
      )
        continue;

      // Optional status filter — skip candidates not matching, if provided
      // if (status && status !== "all" && rawStatus !== status) continue;

      const key = `${hrIdStr}||${companyName}`;
      if (!rowsMap[key]) {
        rowsMap[key] = {
          hr: hrName,
          company: companyName,
          resumeStatus: 0, // count of candidates whose resumeStatus === "Sent"
        };
        INTERVIEW_STATUS_COLUMNS.forEach((col) => {
          rowsMap[key][col] = 0;
        });
      }

      if (INTERVIEW_STATUS_COLUMNS.includes(rawStatus)) {
        rowsMap[key][rawStatus] += 1;
      }

      // Count actual resume-sent status from the real DB field
      if (doc.resumeStatus === "Sent") {
        rowsMap[key].resumeStatus += 1;
      }

      // if (rawStatus && INTERVIEW_STATUS_COLUMNS.includes(rawStatus)) {
      //   rowsMap[key][rawStatus] += 1;
      // }
    }

    // const data = Object.values(rowsMap).sort((a, b) => a.hr.localeCompare(b.hr));

    // return res.status(200).json({
    //   success: true,
    //   columns: ["hr", "company", ...INTERVIEW_STATUS_COLUMNS],
    //   data
    // });
    const allRows = Object.values(rowsMap).sort((a, b) =>
      a.hr.localeCompare(b.hr),
    );

    // --- Paginate the already-grouped rows ---
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const totalCount = allRows.length;
    const skip = (pageNum - 1) * limitNum;
    const data = allRows.slice(skip, skip + limitNum);

    return res.status(200).json({
      success: true,
      columns: ["hr", "company", "resumeStatus", ...INTERVIEW_STATUS_COLUMNS],
      data,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalSubmissions: totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

// CSV
// --- 1. Export: Company/Designation Status Report ---
exports.exportCompanyDesignationStatusReport = async (req, res) => {
  try {
    const INTERVIEW_STATUS_COLUMNS = await getInterviewStatusColumns();
    const isSuperadmin = req.user.role === "superadmin";
    const { hrId, company, designation, startDate, endDate, status } =
      req.query;

    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }
    //  else {
    //   const start = new Date(); start.setHours(0, 0, 0, 0);
    //   const end = new Date(); end.setHours(23, 59, 59, 999);
    //   match.createdAt = { $gte: start, $lte: end };
    // }

    if (!isSuperadmin) {
      match.hrId = new mongoose.Types.ObjectId(req.user.id);
    } else if (hrId && hrId !== "all" && mongoose.isValidObjectId(hrId)) {
      match.hrId = new mongoose.Types.ObjectId(hrId);
    }

    if (company && company !== "all") match.companyName = company;
    if (designation && designation !== "all")
      match.candidateDesignation = designation;

    const docs = await TalentCorner.find(match).select(
      "companyName candidateDesignation interviewStatus",
    );

    const rowsMap = {};
    for (const doc of docs) {
      const companyName = doc.companyName || "Unassigned";
      const desig = doc.candidateDesignation || "Unassigned";
      const rawStatus = doc.interviewStatus || "Resume Shared";

      if (status && status !== "all" && rawStatus !== status) continue;

      const key = `${companyName}||${desig}`;
      if (!rowsMap[key]) {
        rowsMap[key] = { company: companyName, designation: desig };
        INTERVIEW_STATUS_COLUMNS.forEach((col) => {
          rowsMap[key][col] = 0;
        });
      }
      if (INTERVIEW_STATUS_COLUMNS.includes(rawStatus)) {
        rowsMap[key][rawStatus] += 1;
      }
    }

    const allRows = Object.values(rowsMap).sort((a, b) =>
      a.company.localeCompare(b.company),
    );

    const headers = ["Company", "Designation", ...INTERVIEW_STATUS_COLUMNS];
    let csvContent = headers.join(",") + "\n";

    for (const row of allRows) {
      const line = [
        escapeCSV(row.company),
        escapeCSV(row.designation),
        ...INTERVIEW_STATUS_COLUMNS.map((col) => escapeCSV(row[col])),
      ];
      csvContent += line.join(",") + "\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=company_designation_status_report.csv",
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 2. Export: Candidate Details Report ---
exports.exportCandidateDetailsReport = async (req, res) => {
  try {
    const isSuperadmin = req.user.role === "superadmin";
    const { hrId, company, designation, startDate, endDate, status } =
      req.query;

    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }
    // No default "today only" filter — matches getCandidateDetailsReport's behavior.

    if (!isSuperadmin) {
      match.hrId = new mongoose.Types.ObjectId(req.user.id);
    } else if (hrId && hrId !== "all" && mongoose.isValidObjectId(hrId)) {
      match.hrId = new mongoose.Types.ObjectId(hrId);
    }

    if (company && company !== "all") match.companyName = company;
    if (designation && designation !== "all")
      match.candidateDesignation = designation;
    if (status && status !== "all") match.interviewStatus = status;

    const candidates = await TalentCorner.find(match)
      .populate("hrId", "name")
      .select(
        "candidateName hrId companyName candidateDesignation interviewStatus resumeStatus  createdAt",
      )
      .sort({ createdAt: -1 });

    const headers = [
      "Candidate Name",
      "HR Name",
      "Company",
      "Designation",
      "Resume Shared Date",
      "Current Status",
    ];
    let csvContent = headers.join(",") + "\n";

    for (const doc of candidates) {
      const resumeSharedDate =
        doc.resumeStatus === "Sent" ? formatDate(doc.createdAt) : "NA";

      const row = [
        escapeCSV(doc.candidateName || "—"),
        escapeCSV(doc.hrId?.name || "Unknown"),
        escapeCSV(doc.companyName || "Unassigned"),
        escapeCSV(doc.candidateDesignation || "—"),
        escapeCSV(resumeSharedDate),
        escapeCSV(doc.interviewStatus || "Resume Shared"),
      ];
      csvContent += row.join(",") + "\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=candidate_details_report.csv",
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 3. Export: HR/Company Status Report ---
exports.exportHrCompanyStatusReport = async (req, res) => {
  try {
    const INTERVIEW_STATUS_COLUMNS = await getInterviewStatusColumns();
    const isSuperadmin = req.user.role === "superadmin";
    const { hrId, company, startDate, endDate, status } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }
    // No default "today only" filter — matches getHrCompanyStatusReport's behavior.

    if (!isSuperadmin) {
      match.hrId = new mongoose.Types.ObjectId(req.user.id);
    } else if (hrId && hrId !== "all" && mongoose.isValidObjectId(hrId)) {
      match.hrId = new mongoose.Types.ObjectId(hrId);
    }

    if (company && company !== "all") match.companyName = company;

    const docs = await TalentCorner.find(match).select(
      "hrId companyName interviewStatus",
    );

    const hrIds = [
      ...new Set(docs.map((d) => d.hrId?.toString()).filter(Boolean)),
    ];
    const hrUsers = await User.find({ _id: { $in: hrIds } }).select("name");
    const hrNameMap = {};
    hrUsers.forEach((u) => {
      hrNameMap[u._id.toString()] = u.name;
    });

    const rowsMap = {};
    for (const doc of docs) {
      const hrIdStr = doc.hrId ? doc.hrId.toString() : "unknown";
      const hrName = hrNameMap[hrIdStr] || "Unknown";
      const companyName = doc.companyName || "Unassigned";
      const rawStatus = doc.interviewStatus || "Resume Shared";

      if (status && status !== "all" && rawStatus !== status) continue;

      const key = `${hrIdStr}||${companyName}`;
      if (!rowsMap[key]) {
        rowsMap[key] = { hr: hrName, company: companyName };
        INTERVIEW_STATUS_COLUMNS.forEach((col) => {
          rowsMap[key][col] = 0;
        });
      }
      if (INTERVIEW_STATUS_COLUMNS.includes(rawStatus)) {
        rowsMap[key][rawStatus] += 1;
      }
    }

    const allRows = Object.values(rowsMap).sort((a, b) =>
      a.hr.localeCompare(b.hr),
    );

    const headers = ["HR", "Company", ...INTERVIEW_STATUS_COLUMNS];
    let csvContent = headers.join(",") + "\n";

    for (const row of allRows) {
      const line = [
        escapeCSV(row.hr),
        escapeCSV(row.company),
        ...INTERVIEW_STATUS_COLUMNS.map((col) => escapeCSV(row[col])),
      ];
      csvContent += line.join(",") + "\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=hr_company_status_report.csv",
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
