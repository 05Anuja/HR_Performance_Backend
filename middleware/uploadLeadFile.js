const multer = require("multer");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "uploads", "leads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, `leads-${uniqueSuffix}${safeExt}`);
  },
});

const allowedExts = [".csv", ".xlsx", ".xls"];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only CSV (.csv) and Excel (.xlsx, .xls) files are allowed."),
      false
    );
  }
};

const uploadLeadFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

module.exports = uploadLeadFile;
