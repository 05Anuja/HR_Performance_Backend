const User = require("../models/User");
const bcrypt = require("bcryptjs");
const buildDateFilter = require("../utils/dateFilter");

/**
 * Create a new HR user (Superadmin only).
 */
exports.createHR = async (req, res) => {
  try {
    const { name, ecn, password, projects, status } = req.body;

    // Body Validation
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required and must be a string." });
    }
    if (!ecn || !/^\d{5}$/.test(ecn)) {
      return res.status(400).json({ message: "ECN is required and must be a valid 5-digit number." });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password is required and must be at least 6 characters long." });
    }

    if (!status || (status !== "active" && status !== "inactive")) {
      return res.status(400).json({ message: "Status is required and must be either 'active' or 'inactive'." });
    }

    // Normalize and validate projects if provided
    let verifiedProjects = [];
    if (projects !== undefined) {
      let projectsArray = [];
      if (typeof projects === "string") {
        const trimmed = projects.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            projectsArray = JSON.parse(trimmed);
          } catch (e) {
            projectsArray = [trimmed];
          }
        } else if (trimmed.includes(",")) {
          projectsArray = trimmed.split(",").map(p => p.trim());
        } else if (trimmed !== "") {
          projectsArray = [trimmed];
        }
      } else if (Array.isArray(projects)) {
        projectsArray = projects;
      } else {
        return res.status(400).json({ message: "Projects must be an array or a string." });
      }

      verifiedProjects = projectsArray;
    }

    // Check if ECN already exists
    const existingUser = await User.findOne({ ecn });
    if (existingUser) {
      return res.status(400).json({ message: "User with this ECN already exists." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the HR user
    const newUser = await User.create({
      name: name.trim(),
      ecn,
      password: hashedPassword,
      role: "hr", // Explicitly enforce role as "hr"
      status: status,
      projects: verifiedProjects,
    });

    // Strip password from the response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: "HR user created successfully.",
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all HR users (Superadmin only) with dynamic date filtering and pagination.
 */
exports.getAllHR = async (req, res) => {
  try {
    const { search } = req.query;

    // Apply centralized date filtering
    const dateQuery = buildDateFilter(req.query, "createdAt");
    const query = { role: "hr", ...dateQuery };

    if (search) {
      const escapedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { ecn: { $regex: escapedSearch, $options: "i" } }
      ];
    }

    const total = await User.countDocuments(query);

    const page = req.query.page ? parseInt(req.query.page) : null;
    let limit = req.query.limit === "all" ? null : (req.query.limit ? parseInt(req.query.limit) : null);

    if (page && !limit) {
      limit = 10;
    }

    let mongooseQuery = User.find(query)
      .select("-password") // Exclude password from the query
      .sort({ createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      mongooseQuery = mongooseQuery.skip(skip).limit(limit);
    }

    const hrUsers = await mongooseQuery;

    res.status(200).json({
      hrUsers,
      currentPage: page || 1,
      totalPages: limit ? Math.ceil(total / limit) : 1,
      totalHRUsers: total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update HR details (Superadmin only).
 * Supports updating name, projects, password, and status. Excludes ecn from being modified.
 */
exports.updateAllHRs = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, projects, password, status } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "HR user not found." });
    }

    if (user.role !== "hr") {
      return res.status(400).json({ message: "Only HR user details can be updated." });
    }

    // 1. Update Name (optional)
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Name must be a valid non-empty string." });
      }
      user.name = name.trim();
    }

    // 2. Update Password (optional, securely hashed)
    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long." });
      }
      user.password = await bcrypt.hash(password, 10);
    }

    // 3. Update Projects (optional)
    if (projects !== undefined) {
      let projectsArray = [];
      if (typeof projects === "string") {
        const trimmed = projects.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            projectsArray = JSON.parse(trimmed);
          } catch (e) {
            projectsArray = [trimmed];
          }
        } else if (trimmed.includes(",")) {
          projectsArray = trimmed.split(",").map(p => p.trim());
        } else if (trimmed !== "") {
          projectsArray = [trimmed];
        }
      } else if (Array.isArray(projects)) {
        projectsArray = projects;
      } else {
        return res.status(400).json({ message: "Projects must be an array or a string." });
      }

      user.projects = projectsArray;
    }

    // 4. Update Status (optional)
    if (status !== undefined) {
      if (status !== "active" && status !== "inactive") {
        return res.status(400).json({ message: "Status must be either 'active' or 'inactive'." });
      }
      user.status = status;
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      message: "HR user updated successfully.",
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete an HR user (Superadmin only).
 */
exports.deleteHR = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Rule: User deletion only deletes HR users. Superadmins cannot be deleted.
    if (user.role === "superadmin") {
      return res.status(400).json({ message: "Deletion of superadmin users is prohibited." });
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      message: "HR user deleted successfully. Associated talent and recruitment records remain intact.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get profile information of the logged-in user.
 * Returns exactly name, role, projects, and ecn.
 */
exports.getProfile = async (req, res) => {
  try {  
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.status(200).json({
      name: user.name,
      role: user.role,
      projects: user.projects || [],
      ecn: user.ecn
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update profile details (self-service).
 * Supports updating only name, ecn, and password.
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, ecn, password } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 1. Update Name (optional)
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Name must be a valid non-empty string." });
      }
      user.name = name.trim();
    }

    // 2. Update ECN (optional, with 5-digit formatting and uniqueness validation)
    if (ecn !== undefined) {
      if (!/^\d{5}$/.test(ecn)) {
        return res.status(400).json({ message: "ECN must be a valid 5-digit number." });
      }
      const existingUser = await User.findOne({ ecn, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: "User with this ECN already exists." });
      }
      user.ecn = ecn;
    }

    // 3. Update Password (optional, securely hashed)
    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long." });
      }
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully.",
      user: {
        name: user.name,
        role: user.role,
        projects: user.projects || [],
        ecn: user.ecn
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
