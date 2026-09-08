// const multer = require("multer");
// const fs = require("fs");
// const path = require("path");

// //const uploadDir = path.join(__dirname, "..", "uploads", "resumes");
// const uploadDir = "/opt/data/hrmp/uploads/resumes"
// // Ensure the uploads folder exists
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     // e.g. 1657891234567-9a3f2c.pdf / .doc / .docx
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     const safeExt = path.extname(file.originalname).toLowerCase();
//     cb(null, `${uniqueSuffix}${safeExt}`);
//   }
// });

// // Allowed file types: PDF, DOC, DOCX
// const allowedMimeTypes = [
//   "application/pdf",
//   "application/msword", // .doc
//   "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
// ];
// const allowedExts = [".pdf", ".doc", ".docx"];

// const fileFilter = (req, file, cb) => {
//   const ext = path.extname(file.originalname).toLowerCase();
//   const isAllowedMime = allowedMimeTypes.includes(file.mimetype);
//   const isAllowedExt = allowedExts.includes(ext);

//   if (isAllowedMime && isAllowedExt) {
//     cb(null, true);
//   } else {
//     cb(new Error("Only PDF, DOC, or DOCX files are allowed for the resume."), false);
//   }
// };

// const uploadResume = multer({
//   storage,
//   fileFilter,
// });

// module.exports = uploadResume;

const multer = require("multer");
const fs = require("fs");
const path = require("path");

// const uploadDir = path.join(__dirname, "..", "uploads", "resumes");
const uploadDir = "/opt/data/hrmp/uploads/resumes";

// Ensure the uploads folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // e.g. 1657891234567-9a3f2c.pdf / .doc / .docx
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${safeExt}`);
  },
});

// Allowed file types: PDF, DOC, DOCX
const allowedMimeTypes = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];
const allowedExts = [".pdf", ".doc", ".docx"];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isAllowedMime = allowedMimeTypes.includes(file.mimetype);
  const isAllowedExt = allowedExts.includes(ext);

  if (isAllowedMime && isAllowedExt) {
    cb(null, true);
  } else {
    cb(
      new Error("Only PDF, DOC, or DOCX files are allowed for the resume."),
      false,
    );
  }
};

const uploadResume = multer({
  storage,
  fileFilter,
});

module.exports = uploadResume;
