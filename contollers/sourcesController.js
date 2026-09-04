const Sources = require("../models/Sources");
const AuditLog = require("../models/AuditLog");

// Create a new source (Superadmin only)
exports.createSource = async (req, res) => {
  try {
    const { sourceName, project } = req.body;

    if (!sourceName || !sourceName.trim()) {
      return res.status(400).json({ message: "Source name is required." });
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

    const existing = await Sources.findOne({ sourceName: sourceName.trim() });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Source with this name already exists." });
    }

    const source = await Sources.create({
      sourceName: sourceName.trim(),
      project: projectArray,
      createdBy: req.user.id,
    });

    await AuditLog.create({
      action: "CREATE_SOURCE",
      details: `Source '${source.sourceName}' created for projects [${source.project.join(", ")}] by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(201).json({
      message: "Source created successfully.",
      data: source,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all sources (Authenticated users, optional project filter, paginated)
exports.getSources = async (req, res) => {
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

    const total = await Sources.countDocuments(query);
    const sources = await Sources.find(query)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data: sources,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalSources: total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a source by ID (Authenticated users)
exports.getSourceById = async (req, res) => {
  try {
    const { id } = req.params;
    const source = await Sources.findById(id).populate("createdBy", "name");

    if (!source) {
      return res.status(404).json({ message: "Source not found." });
    }

    res.status(200).json({ data: source });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a source (Superadmin only)
exports.updateSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceName, project } = req.body;

    const source = await Sources.findById(id);
    if (!source) {
      return res.status(404).json({ message: "Source not found." });
    }

    if (sourceName !== undefined) {
      if (!sourceName.trim()) {
        return res
          .status(400)
          .json({ message: "Source name cannot be empty." });
      }

      const duplicate = await Sources.findOne({
        sourceName: sourceName.trim(),
        _id: { $ne: id },
      });
      if (duplicate) {
        return res
          .status(400)
          .json({ message: "Source with this name already exists." });
      }
      source.sourceName = sourceName.trim();
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
      source.project = projectArray;
    }

    await source.save();

    await AuditLog.create({
      action: "UPDATE_SOURCE",
      details: `Source id '${source._id}' ('${source.sourceName}') updated by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(200).json({
      message: "Source updated successfully.",
      data: source,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a source (Superadmin only)
exports.deleteSource = async (req, res) => {
  try {
    const { id } = req.params;

    const source = await Sources.findById(id);
    if (!source) {
      return res.status(404).json({ message: "Source not found." });
    }

    await Sources.findByIdAndDelete(id);

    await AuditLog.create({
      action: "DELETE_SOURCE",
      details: `Source '${source.sourceName}' was deleted by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(200).json({ message: "Source deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
