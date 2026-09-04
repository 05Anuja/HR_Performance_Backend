const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    const { name, ecn, password, role, projects } = req.body;

    if (!ecn || !/^\d{5}$/.test(ecn)) {
      return res.status(400).json({ message: "ECN must be a valid 5-digit number." });
    }

    const existingUser = await User.findOne({ ecn });
    if (existingUser) {
      return res.status(400).json({ message: "User with this ECN already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      ecn,
      password: hashedPassword,
      role,
      projects,
    });

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { ecn, password } = req.body;

    if (!ecn || !password) {
      return res.status(400).json({ message: "Please provide ECN and password." });
    }

    if (!/^\d{5}$/.test(ecn)) {
      return res.status(400).json({ message: "ECN must be a 5-digit number." });
    }

    const user = await User.findOne({ ecn: ecn.trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid ECN or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid ECN or password." });
    }

    // Check account status and block if inactive
    if (user.status === "inactive") {
      return res.status(403).json({ message: "Your account is deactivated. Please contact the administrator." });
    }

    // Clean-up: filter out old legacy projects that are not part of Silgate / Talent Corner
    const activeNames = ["Silgate", "Talent Corner"];

    const originalLength = user.projects.length;
    user.projects = user.projects.filter((p) => activeNames.includes(p));
    if (user.projects.length !== originalLength) {
      user.markModified("projects");
      await user.save();
    }

    // Generate JWT token (expires in 1 day)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        name: user.name,
        role: user.role,
        projects: user.projects,
        ecn: user.ecn,
        status: user.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
