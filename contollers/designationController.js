const Designation = require("../models/Designation");
const AuditLog = require("../models/AuditLog");

// Create a new designation (Superadmin only)
exports.createDesignation = async (req, res) => {
  try {
    const { name, project } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Designation name is required." });
    }

    const projectArray = Array.isArray(project)
      ? project
      : project
        ? [project]
        : [];

    if (projectArray.length === 0) {
      return res.status(400).json({ message: "Project field is required and must contain at least one project." });
    }

    const invalidProjects = projectArray.filter(
      (p) => !["Silgate", "Talent Corner"].includes(p)
    );
    if (invalidProjects.length > 0) {
      return res.status(400).json({
        message: `Invalid project(s): ${invalidProjects.join(", ")}. Must be 'Silgate' and/or 'Talent Corner'.`,
      });
    }

    const existing = await Designation.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: "Designation with this name already exists." });
    }

    const designation = await Designation.create({
      name: name.trim(),
      project: projectArray,
      createdBy: req.user.id,
    });

    await AuditLog.create({
      action: "CREATE_DESIGNATION",
      details: `Designation '${designation.name}' created for projects [${designation.project.join(", ")}] by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(201).json({
      message: "Designation created successfully.",
      data: designation,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all designations (Authenticated users, optional project filter, paginated)
exports.getDesignations = async (req, res) => {
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

    const total = await Designation.countDocuments(query);
    const designations = await Designation.find(query)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    res.status(200).json({
      data: designations,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalDesignations: total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a designation by ID (Authenticated users)
exports.getDesignationById = async (req, res) => {
  try {
    const { id } = req.params;
    const designation = await Designation.findById(id).populate("createdBy", "name");

    if (!designation) {
      return res.status(404).json({ message: "Designation not found." });
    }

    res.status(200).json({ data: designation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a designation (Superadmin only)
exports.updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, project } = req.body;

    const designation = await Designation.findById(id);
    if (!designation) {
      return res.status(404).json({ message: "Designation not found." });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: "Designation name cannot be empty." });
      }

      const duplicate = await Designation.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });
      if (duplicate) {
        return res.status(400).json({ message: "Designation with this name already exists." });
      }
      designation.name = name.trim();
    }

    if (project !== undefined) {
      const projectArray = Array.isArray(project)
        ? project
        : project
          ? [project]
          : [];

      if (projectArray.length === 0) {
        return res.status(400).json({ message: "Project field must contain at least one project." });
      }

      const invalidProjects = projectArray.filter(
        (p) => !["Silgate", "Talent Corner"].includes(p)
      );
      if (invalidProjects.length > 0) {
        return res.status(400).json({
          message: `Invalid project(s): ${invalidProjects.join(", ")}. Must be 'Silgate' and/or 'Talent Corner'.`,
        });
      }
      designation.project = projectArray;
    }

    await designation.save();

    await AuditLog.create({
      action: "UPDATE_DESIGNATION",
      details: `Designation id '${designation._id}' ('${designation.name}') updated by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(200).json({
      message: "Designation updated successfully.",
      data: designation,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a designation (Superadmin only)
exports.deleteDesignation = async (req, res) => {
  try {
    const { id } = req.params;

    const designation = await Designation.findById(id);
    if (!designation) {
      return res.status(404).json({ message: "Designation not found." });
    }

    await Designation.findByIdAndDelete(id);

    await AuditLog.create({
      action: "DELETE_DESIGNATION",
      details: `Designation '${designation.name}' was deleted by user '${req.user.name}'.`,
      performedBy: req.user.id,
    });

    res.status(200).json({ message: "Designation deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
