const InterviewStatus = require("../models/InterviewStatus");
const AuditLog = require("../models/AuditLog");

// Create a new interview status (Superadmin only)
exports.createInterviewStatus = async (req, res) => {
  try {
    const { interviewStatus, project } = req.body;

    if (!interviewStatus || !interviewStatus.trim()) {
      return res
        .status(400)
        .json({ message: "Interview status name is required." });
    }

    const projectArray = Array.isArray(project)
      ? project
      : project
        ? [project]
        : [];

    if (projectArray.length === 0) {
      return res.status(400).json({
        message:
          "Project field is required and must contain at least one project.",
      });
    }

    const invalidProjects = projectArray.filter(
      (p) => !["Silgate", "Talent Corner"].includes(p),
    );
    if (invalidProjects.length > 0) {
      return res.status(400).json({
        message: `Invalid project(s): ${invalidProjects.join(", ")}. Must be 'Silgate' and/or 'Talent Corner'.`,
      });
    }

    const existing = await InterviewStatus.findOne({
      interviewStatus: interviewStatus.trim(),
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Interview status with this name already exists." });
    }

    const status = await InterviewStatus.create({
      interviewStatus: interviewStatus.trim(),
      project: projectArray,
      createdBy: req.user.id,
    });

    await AuditLog.create({
      action: "CREATE_INTERVIEW_STATUS",
      details: `Interview status '${status.interviewStatus}' created for projects [${status.project.join(", ")}] by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(201).json({
      message: "Interview status created successfully.",
      data: status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all interview statuses (Authenticated users, optional project filter, paginated)
exports.getInterviewStatuses = async (req, res) => {
  try {
    const { project } = req.query;
    const query = {};

    if (project) {
      if (!["Silgate", "Talent Corner"].includes(project)) {
        return res.status(400).json({ message: "Invalid project filter." });
      }
      query.project = project;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await InterviewStatus.countDocuments(query);
    const statuses = await InterviewStatus.find(query)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data: statuses,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalInterviewStatuses: total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get an interview status by ID (Authenticated users)
exports.getInterviewStatusById = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await InterviewStatus.findById(id).populate(
      "createdBy",
      "name",
    );

    if (!status) {
      return res.status(404).json({ message: "Interview status not found." });
    }

    res.status(200).json({ data: status });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an interview status (Superadmin only)
exports.updateInterviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { interviewStatus, project } = req.body;

    const status = await InterviewStatus.findById(id);
    if (!status) {
      return res.status(404).json({ message: "Interview status not found." });
    }

    if (interviewStatus !== undefined) {
      if (!interviewStatus.trim()) {
        return res
          .status(400)
          .json({ message: "Interview status name cannot be empty." });
      }

      const duplicate = await InterviewStatus.findOne({
        interviewStatus: interviewStatus.trim(),
        _id: { $ne: id },
      });
      if (duplicate) {
        return res
          .status(400)
          .json({ message: "Interview status with this name already exists." });
      }
      status.interviewStatus = interviewStatus.trim();
    }

    if (project !== undefined) {
      const projectArray = Array.isArray(project)
        ? project
        : project
          ? [project]
          : [];

      if (projectArray.length === 0) {
        return res.status(400).json({
          message: "Project field must contain at least one project.",
        });
      }

      const invalidProjects = projectArray.filter(
        (p) => !["Silgate", "Talent Corner"].includes(p),
      );
      if (invalidProjects.length > 0) {
        return res.status(400).json({
          message: `Invalid project(s): ${invalidProjects.join(", ")}. Must be 'Silgate' and/or 'Talent Corner'.`,
        });
      }
      status.project = projectArray;
    }

    await status.save();

    await AuditLog.create({
      action: "UPDATE_INTERVIEW_STATUS",
      details: `Interview status id '${status._id}' ('${status.interviewStatus}') updated by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(200).json({
      message: "Interview status updated successfully.",
      data: status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete an interview status (Superadmin only)
exports.deleteInterviewStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const status = await InterviewStatus.findById(id);
    if (!status) {
      return res.status(404).json({ message: "Interview status not found." });
    }

    await InterviewStatus.findByIdAndDelete(id);

    await AuditLog.create({
      action: "DELETE_INTERVIEW_STATUS",
      details: `Interview status '${status.interviewStatus}' was deleted by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(200).json({ message: "Interview status deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
