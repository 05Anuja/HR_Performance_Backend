const Disposition = require("../models/Disposition");
const AuditLog = require("../models/AuditLog");

// Create a new disposition (Superadmin only)
exports.createDisposition = async (req, res) => {
  try {
    const { disposition, project } = req.body;

    if (!disposition || !disposition.trim()) {
      return res.status(400).json({ message: "Disposition name is required." });
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
      (p) => !["Silgate"].includes(p),
    );
    if (invalidProjects.length > 0) {
      return res.status(400).json({
        message: `Invalid project(s): ${invalidProjects.join(", ")}. Must be 'Silgate'.`,
      });
    }

    const existing = await Disposition.findOne({
      disposition: disposition.trim(),
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Disposition with this name already exists." });
    }

    const dispositionDoc = await Disposition.create({
      disposition: disposition.trim(),
      project: projectArray,
      createdBy: req.user.id,
    });

    await AuditLog.create({
      action: "CREATE_DISPOSITION",
      details: `Disposition '${dispositionDoc.disposition}' created for projects [${dispositionDoc.project.join(", ")}] by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(201).json({
      message: "Disposition created successfully.",
      data: dispositionDoc,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all dispositions (Authenticated users, optional project filter, paginated)
exports.getDispositions = async (req, res) => {
  try {
    const { project } = req.query;
    const query = {};

    if (project) {
      if (!["Silgate"].includes(project)) {
        return res.status(400).json({ message: "Invalid project filter." });
      }
      query.project = project;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Disposition.countDocuments(query);
    const dispositions = await Disposition.find(query)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data: dispositions,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalDispositions: total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a disposition by ID (Authenticated users)
exports.getDispositionById = async (req, res) => {
  try {
    const { id } = req.params;
    const dispositionDoc = await Disposition.findById(id).populate(
      "createdBy",
      "name",
    );

    if (!dispositionDoc) {
      return res.status(404).json({ message: "Disposition not found." });
    }

    res.status(200).json({ data: dispositionDoc });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a disposition (Superadmin only)
exports.updateDisposition = async (req, res) => {
  try {
    const { id } = req.params;
    const { disposition, project } = req.body;

    const dispositionDoc = await Disposition.findById(id);
    if (!dispositionDoc) {
      return res.status(404).json({ message: "Disposition not found." });
    }

    if (disposition !== undefined) {
      if (!disposition.trim()) {
        return res
          .status(400)
          .json({ message: "Disposition name cannot be empty." });
      }

      const duplicate = await Disposition.findOne({
        disposition: disposition.trim(),
        _id: { $ne: id },
      });
      if (duplicate) {
        return res
          .status(400)
          .json({ message: "Disposition with this name already exists." });
      }
      dispositionDoc.disposition = disposition.trim();
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
        (p) => !["Silgate"].includes(p),
      );
      if (invalidProjects.length > 0) {
        return res.status(400).json({
          message: `Invalid project(s): ${invalidProjects.join(", ")}. Must be 'Silgate'.`,
        });
      }
      dispositionDoc.project = projectArray;
    }

    await dispositionDoc.save();

    await AuditLog.create({
      action: "UPDATE_DISPOSITION",
      details: `Disposition id '${dispositionDoc._id}' ('${dispositionDoc.disposition}') updated by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(200).json({
      message: "Disposition updated successfully.",
      data: dispositionDoc,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a disposition (Superadmin only)
exports.deleteDisposition = async (req, res) => {
  try {
    const { id } = req.params;

    const dispositionDoc = await Disposition.findById(id);
    if (!dispositionDoc) {
      return res.status(404).json({ message: "Disposition not found." });
    }

    await Disposition.findByIdAndDelete(id);

    await AuditLog.create({
      action: "DELETE_DISPOSITION",
      details: `Disposition '${dispositionDoc.disposition}' was deleted by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(200).json({ message: "Disposition deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
